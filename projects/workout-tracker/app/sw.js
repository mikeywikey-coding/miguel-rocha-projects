"use strict";

const CACHE = "gym-v1.23";
const MEDIA = [
  "Barbell_Squat",
  "Goblet_Squat",
  "Barbell_Hip_Thrust",
  "Leg_Extensions",
  "Seated_Leg_Curl",
  "Standing_Calf_Raises",
  "Hack_Squat",
  "Romanian_Deadlift",
  "Thigh_Abductor",
  "Seated_Calf_Raise",
  "Leg_Press",
  "Thigh_Adductor",
  "Barbell_Glute_Bridge",
  "Glute_Kickback",
  "Lying_Leg_Curls",
  "Calf_Press_On_The_Leg_Press_Machine",
  "Cable_Hip_Adduction",
  "Dumbbell_Bench_Press",
  "Barbell_Bench_Press_-_Medium_Grip",
  "Machine_Bench_Press",
  "Bent_Over_Barbell_Row",
  "One-Arm_Dumbbell_Row",
  "Seated_Cable_Rows",
  "Wide-Grip_Lat_Pulldown",
  "Pullups",
  "Dumbbell_Shoulder_Press",
  "Standing_Military_Press",
  "Machine_Shoulder_Military_Press",
  "Side_Lateral_Raise",
  "Dumbbell_Bicep_Curl",
  "Standing_Biceps_Cable_Curl",
  "Triceps_Pushdown",
  "Standing_Dumbbell_Triceps_Extension",
  "Crunches",
  "Dumbbell_Lunges",
  "Incline_Dumbbell_Press",
  "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "Cable_Crossover",
  "Hammer_Curls",
  "Front_Barbell_Squat",
];
const JS = [
  "main.js",
  "dom.js",
  "state.js",
  "program.js",
  "timer.js",
  "home.js",
  "workout.js",
  "history.js",
  "profile.js",
  "muscleMap.js",
  "stats.js",
];
// the shell must install completely; media is best-effort (the fetch
// handler backfills anything missed at runtime)
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
].concat(JS.map((f) => `./js/${f}`));

const MEDIA_FILES = MEDIA.flatMap((m) => [`./media/${m}_0.jpg`, `./media/${m}_1.jpg`]);

self.addEventListener("install", (e) => {
  // no skipWaiting here: the new version waits until the app's
  // "Update now" banner tells it to take over
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(SHELL);
      // one flaky image download must not block the whole update
      await Promise.allSettled(MEDIA_FILES.map((u) => c.add(u)));
    })(),
  );
});

// Rest-timer alarm, scheduled in the worker rather than the page. A page's
// setTimeout is frozen once the app is backgrounded, so the alert only landed
// when you came back. waitUntil() keeps this worker alive for the rest period,
// so the notification fires on time with the app in the background or the
// screen off. `alarmGen` invalidates a pending alarm when one is cancelled or
// replaced, so only the newest timer can ever fire.
let alarmGen = 0;

async function fireRestNotification() {
  await self.registration.showNotification("Rest done 💪", {
    body: "Time for your next set",
    tag: "rest-timer",
    renotify: true,
    vibrate: [300, 150, 300, 150, 300],
    silent: false,
  });
  // tell the page so it clears the timer bar without alerting a second time
  const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) c.postMessage({ type: "REST_ALARM_FIRED" });
}

self.addEventListener("message", (e) => {
  const msg = e.data;
  if (msg === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "REST_ALARM_CANCEL") {
    alarmGen++;
    return;
  }

  if (msg.type === "REST_ALARM") {
    const gen = ++alarmGen;
    const delay = Math.max(0, Math.min(Number(msg.delay) || 0, 30 * 60 * 1000));
    e.waitUntil(
      new Promise((resolve) => {
        setTimeout(() => {
          if (gen !== alarmGen) return resolve(); // cancelled or superseded
          fireRestNotification()
            .catch(() => {})
            .then(resolve, resolve);
        }, delay);
      }),
    );
  }
});

// tapping the rest-timer alarm notification focuses (or opens) the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first; new requests (e.g. Google Fonts files) get cached at runtime.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request)
        .then((res) => {
          if (res.ok || res.type === "opaque") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => {
          if (e.request.mode === "navigate") return caches.match("./index.html");
          throw new Error("offline");
        });
    }),
  );
});
