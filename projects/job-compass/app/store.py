from pathlib import Path
import os, sqlite3, json, secrets
from datetime import datetime, timezone
from cryptography.fernet import Fernet

ROOT=Path(__file__).resolve().parent.parent
DATA=Path(os.environ.get('COMPASS_DATA',ROOT/'data'))

def now():return datetime.now(timezone.utc).isoformat()

def db():
    connection=sqlite3.connect(DATA/'compass.db',timeout=20)
    connection.row_factory=sqlite3.Row
    connection.execute('PRAGMA foreign_keys=ON')
    return connection

def query(sql,args=()):
    with db() as c:return [dict(x) for x in c.execute(sql,args).fetchall()]

def execute(sql,args=()):
    with db() as c:return c.execute(sql,args).lastrowid

def setting(key,default=None):
    rows=query('SELECT value FROM settings WHERE key=?',(key,))
    return json.loads(rows[0]['value']) if rows else default

def save(key,value):execute('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',(key,json.dumps(value)))

def encrypt(value):return Fernet((DATA/'encryption.key').read_bytes()).encrypt(json.dumps(value).encode()).decode()
def decrypt(value):return json.loads(Fernet((DATA/'encryption.key').read_bytes()).decrypt(value.encode()))

def init():
    DATA.mkdir(parents=True,exist_ok=True)
    (DATA/'cvs').mkdir(exist_ok=True)
    if not (DATA/'encryption.key').exists():(DATA/'encryption.key').write_bytes(Fernet.generate_key())
    with db() as c:
        c.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,board TEXT NOT NULL DEFAULT '',url TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,last_attempt TEXT,last_success TEXT,error TEXT,count INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,url TEXT UNIQUE NOT NULL,title TEXT NOT NULL,company TEXT NOT NULL,location TEXT NOT NULL,description TEXT NOT NULL,source TEXT NOT NULL,posted TEXT,created TEXT NOT NULL,seen TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',score INTEGER NOT NULL,analysis TEXT NOT NULL,draft TEXT,cv TEXT,revision INTEGER NOT NULL DEFAULT 0,approval TEXT,applied_at TEXT);
        CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,thread TEXT NOT NULL,subject TEXT NOT NULL,sender TEXT NOT NULL,excerpt TEXT NOT NULL,received TEXT NOT NULL,kind TEXT NOT NULL,job_id TEXT REFERENCES jobs(id),reviewed INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,text TEXT NOT NULL);
        ''')
    if not setting('profile'):
        save('profile',dict(first_name='Miguel',last_name='Rocha',email='',phone='',location='Lisbon, Portugal',skills=['JavaScript','Python','HTML','CSS','React','Playwright','Node.js','Vite','Blender','Excel','Word','PowerPoint','Outlook','Windows'],support=True))
    if not setting('extension_token'):save('extension_token',secrets.token_urlsafe(32))
    if setting('automation') is None:save('automation',True)

def event(text):execute('INSERT INTO activity(at,text) VALUES(?,?)',(now(),text))

def job_view(row):
    result=dict(row)
    result['analysis']=json.loads(result['analysis'])
    result['approval']=json.loads(result['approval']) if result['approval'] else None
    return result
