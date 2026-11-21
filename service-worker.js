const CACHE_NAME = "polish-learning-v2";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.webmanifest",
    "./vocabulary.json",
    "./grammar_tutorial.json",
    "./grammar_verb_tenses.json",
    "./grammar_cases.json",
    "./grammar_mixed.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png",
    "./listening_sentences.json",
];

// Zapisuje wszystkie pliki potrzebne do działania offline.
self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_FILES);
        })
    );
});

// Usuwa stare wersje pamięci tej aplikacji.
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (names) {
            return Promise.all(
                names
                    .filter(function (name) {
                        return (
                            name.startsWith("polish-learning-") &&
                            name !== CACHE_NAME
                        );
                    })
                    .map(function (name) {
                        return caches.delete(name);
                    })
            );
        })
    );
});

// Obsługuje tylko pliki z tej samej domeny i folderu aplikacji.
self.addEventListener("fetch", function (event) {
    const request = event.request;
    const url = new URL(request.url);
    const scope = new URL(self.registration.scope);

    if (
        request.method !== "GET" ||
        url.origin !== scope.origin ||
        !url.pathname.startsWith(scope.pathname)
    ) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async function (cache) {
            const cached = await cache.match(request);

            if (cached) {
                return cached;
            }

            try {
                return await fetch(request);
            } catch (error) {
                if (request.mode === "navigate") {
                    const page = await cache.match("./index.html");

                    if (page) {
                        return page;
                    }
                }

                return Response.error();
            }
        })
    );
});