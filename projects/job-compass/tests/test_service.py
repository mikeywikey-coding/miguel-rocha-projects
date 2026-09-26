import logging.config
import sys

def test_background_logging_works_without_a_console(tmp_path,monkeypatch):
    from app.service import logging_config
    with monkeypatch.context() as patch:
        patch.setattr(sys,'stdout',None)
        patch.setattr(sys,'stderr',None)
        config=logging_config(tmp_path)
        handler_config=config['handlers']['file']
        handler=logging.handlers.RotatingFileHandler(**{key:value for key,value in handler_config.items() if key not in ('class','formatter')})
        try:
            handler.setFormatter(logging.Formatter(config['formatters']['plain']['format']))
            handler.emit(logging.LogRecord('uvicorn.error',logging.INFO,'',0,'Startup test',(),None))
        finally:
            handler.close()
    assert 'Startup test' in (tmp_path/'service.log').read_text(encoding='utf-8')
