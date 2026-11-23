(function () {
    "use strict";

    // ========================================
    // ELEMENTY FORMULARZA
    // ========================================

    const panel = document.getElementById("shared-word-panel");
    const form = document.getElementById("shared-word-form");
    const polishInput = document.getElementById("shared-polish");
    const englishInput = document.getElementById("shared-english");
    const synonymsInput = document.getElementById("shared-synonyms");
    const levelInput = document.getElementById("shared-level");
    const saveButton = document.getElementById("shared-save-button");
    const status = document.getElementById("shared-word-status");

    const client = window.sharedVocabularyClient;

    const sharedCacheKey = "sharedVocabularyCache-v1";
    const allowedLevels = ["A1", "A2", "B1", "B2"];

    let permissionVersion = 0;
    let saving = false;
    let sharedDownload = null;

    window.sharedVocabularyEntries = [];

    // ========================================
    // POMOCNICZE FUNKCJE
    // ========================================

    function cleanText(text) {
        return text
            .normalize("NFC")
            .trim()
            .replace(/\s+/g, " ");
    }

    function isValidSharedEntry(entry) {
        return (
            entry !== null &&
            typeof entry === "object" &&
            allowedLevels.includes(entry.level) &&
            typeof entry.polish === "string" &&
            entry.polish.trim() !== "" &&
            typeof entry.english === "string" &&
            entry.english.trim() !== "" &&
            Array.isArray(entry.synonyms) &&
            entry.synonyms.every(function (synonym) {
                return (
                    typeof synonym === "string" &&
                    synonym.trim() !== ""
                );
            })
        );
    }

    // Aktualizacja w menu nie przerywa trwającej nauki ani quizu.
    function refreshVocabularyMenu() {
        const menu = document.getElementById("menu-screen");

        if (
            menu &&
            !menu.hidden &&
            typeof updateLevel === "function" &&
            typeof vocabularyByLevel !== "undefined" &&
            Object.keys(vocabularyByLevel).length > 0
        ) {
            updateLevel();
        }
    }

    function useSharedEntries(entries) {
        window.sharedVocabularyEntries = entries;
        refreshVocabularyMenu();
    }

    // ========================================
    // KOPIA SŁOWNICTWA NA URZĄDZENIU
    // ========================================

    function loadCachedVocabulary() {
        try {
            const cachedText =
                localStorage.getItem(sharedCacheKey);

            if (cachedText === null) {
                return;
            }

            const cached = JSON.parse(cachedText);

            if (
                Array.isArray(cached) &&
                cached.every(isValidSharedEntry)
            ) {
                useSharedEntries(cached);
            }
        } catch (error) {
            console.warn(
                "Could not read shared vocabulary cache:",
                error
            );
        }
    }

    function saveCachedVocabulary(entries) {
        try {
            localStorage.setItem(
                sharedCacheKey,
                JSON.stringify(entries)
            );
        } catch (error) {
            console.warn(
                "Vocabulary loaded but could not be saved offline:",
                error
            );
        }
    }

    // Kopia offline jest dostępna nawet wtedy,
    // gdy biblioteka Supabase nie została pobrana.
    loadCachedVocabulary();

    // Nowe hasła będą uwzględniane po powrocie do menu.
    [
        "learn-back-button",
        "quiz-back-button",
        "grammar-back-button",
        "tutorial-back-button",
        "listening-back-button"
    ].forEach(function (id) {
        const button = document.getElementById(id);

        if (button) {
            button.addEventListener(
                "click",
                refreshVocabularyMenu
            );
        }
    });

    // ========================================
    // SPRAWDZENIE KONFIGURACJI
    // ========================================

    if (
        !panel ||
        !form ||
        !polishInput ||
        !englishInput ||
        !synonymsInput ||
        !levelInput ||
        !saveButton ||
        !status
    ) {
        console.error(
            "Missing shared vocabulary elements in index.html."
        );
        return;
    }

    panel.hidden = true;

    if (!client) {
        status.textContent =
            "Shared vocabulary updates are unavailable. " +
            "Previously downloaded words remain available.";

        return;
    }

    // ========================================
    // UPRAWNIENIA
    // ========================================

    async function getEditorRole(userId) {
        const { data, error } = await client
            .from("vocabulary_editors")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data?.role || null;
    }

    async function refreshPermissions() {
        const version = ++permissionVersion;

        panel.hidden = true;

        try {
            const { data, error } =
                await client.auth.getSession();

            if (error) {
                throw error;
            }

            if (version !== permissionVersion) {
                return;
            }

            if (!data.session) {
                return;
            }

            const role = await getEditorRole(
                data.session.user.id
            );

            if (version !== permissionVersion) {
                return;
            }

            panel.hidden =
                !["editor", "admin"].includes(role);

        } catch (error) {
            if (version !== permissionVersion) {
                return;
            }

            console.warn(
                "Could not check vocabulary access:",
                error
            );

            // Formularz pozostaje ukryty.
            // Komunikatem o koncie zarządza auth.js.
        }
    }

    // ========================================
    // POBIERANIE WSPÓLNYCH SŁÓW
    // ========================================

    async function fetchSharedVocabulary() {
        const entries = [];
        const pageSize = 500;

        for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await client
                .from("shared_vocabulary")
                .select("id, level, polish, english, synonyms")
                .order("id")
                .range(offset, offset + pageSize - 1);

            if (error) {
                throw error;
            }

            if (
                !Array.isArray(data) ||
                !data.every(isValidSharedEntry)
            ) {
                throw new Error(
                    "Invalid shared vocabulary data."
                );
            }

            entries.push(...data);

            if (data.length < pageSize) {
                break;
            }
        }

        // Zastępuje poprzednie dane dopiero po pobraniu całości.
        useSharedEntries(entries);
        saveCachedVocabulary(entries);

        return true;
    }

    async function loadSharedVocabulary() {
        if (sharedDownload) {
            return sharedDownload;
        }

        sharedDownload = (async function () {
            try {
                return await fetchSharedVocabulary();
            } catch (error) {
                console.warn(
                    "Could not refresh shared vocabulary:",
                    error
                );

                // Zachowuje kopię wcześniej pobranych słów.
                return false;
            }
        })();

        try {
            return await sharedDownload;
        } finally {
            sharedDownload = null;
        }
    }

    // ========================================
    // DODAWANIE SŁOWA
    // ========================================

    form.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            if (saving) {
                return;
            }

            const polish = cleanText(polishInput.value);
            const english = cleanText(englishInput.value);
            const level = levelInput.value;

            const synonyms = [];
            const knownAnswers = new Set([
                polish.toLowerCase()
            ]);

            synonymsInput.value
                .split(";")
                .forEach(function (value) {
                    const synonym = cleanText(value);
                    const key = synonym.toLowerCase();

                    if (
                        synonym &&
                        !knownAnswers.has(key)
                    ) {
                        synonyms.push(synonym);
                        knownAnswers.add(key);
                    }
                });

            if (
                !polish ||
                !english ||
                polish.length > 150 ||
                english.length > 200
            ) {
                status.textContent =
                    "Enter a Polish word and its English translation.";

                return;
            }

            if (!allowedLevels.includes(level)) {
                status.textContent =
                    "Choose a valid level.";

                return;
            }

            if (
                synonyms.length > 20 ||
                synonyms.some(function (word) {
                    return word.length > 150;
                })
            ) {
                status.textContent =
                    "Use up to 20 synonyms, each up to 150 characters.";

                return;
            }

            saving = true;
            saveButton.disabled = true;
            status.textContent = "Saving...";

            try {
                // Weryfikuje konto na serwerze.
                const {
                    data,
                    error: userError
                } = await client.auth.getUser();

                if (userError || !data.user) {
                    status.textContent =
                        "Please sign in again.";

                    return;
                }

                const role = await getEditorRole(
                    data.user.id
                );

                if (!["editor", "admin"].includes(role)) {
                    panel.hidden = true;

                    status.textContent =
                        "This account cannot add vocabulary.";

                    return;
                }

                // Baza ustawia autora i datę.
                // Reguły RLS niezależnie sprawdzają uprawnienia.
                const { error } = await client
                    .from("shared_vocabulary")
                    .insert({
                        level: level,
                        polish: polish,
                        english: english,
                        synonyms: synonyms
                    });

                if (error) {
                    if (error.code === "23505") {
                        status.textContent =
                            "This word and translation already exist at this level.";

                        return;
                    }

                    if (error.code === "42501") {
                        status.textContent =
                            "Permission denied. Check this account's access.";

                        return;
                    }

                    if (error.code === "23514") {
                        status.textContent =
                            "The entry does not meet the database requirements. " +
                            "Check the word, translation and synonyms.";

                        return;
                    }

                    throw error;
                }

                form.reset();
                levelInput.value = level;

                status.textContent =
                    "Saved to the shared database. Refreshing words...";

                // Jeśli trwało już wcześniejsze pobieranie,
                // czeka na nie, a potem pobiera aktualny stan.
                if (sharedDownload) {
                    await sharedDownload;
                }

                const refreshed =
                    await loadSharedVocabulary();

                if (refreshed) {
                    status.textContent =
                        "Added: " + polish +
                        " — " + english +
                        ". Shared vocabulary updated.";
                } else {
                    status.textContent =
                        "Saved: " + polish +
                        " — " + english +
                        ". Could not refresh the word list yet.";
                }

            } catch (error) {
                console.error(
                    "Could not save shared vocabulary:",
                    error
                );

                status.textContent =
                    "Could not confirm the save. Check your connection. " +
                    "If you retry the same entry, duplicates are blocked.";

            } finally {
                saving = false;
                saveButton.disabled = false;
            }
        }
    );

    // ========================================
    // ZMIANA KONTA I ODZYSKANIE POŁĄCZENIA
    // ========================================

    client.auth.onAuthStateChange(function () {
        permissionVersion++;

        panel.hidden = true;
        panel.open = false;

        if (!saving) {
            status.textContent = "";
        }

        // Zapytania wykonujemy poza callbackiem Supabase Auth.
        setTimeout(function () {
            refreshPermissions();
        }, 0);
    });

    window.addEventListener("online", function () {
        refreshPermissions();
        loadSharedVocabulary();
    });

    // ========================================
    // URUCHOMIENIE
    // ========================================
    window.addEventListener(
    "shared-vocabulary-changed",
    async function () {
        // Kończy poprzednie pobieranie, a potem pobiera nowy stan.
        if (sharedDownload) {
            await sharedDownload;
        }

        await loadSharedVocabulary();
    }
);
    refreshPermissions();
    loadSharedVocabulary();
})();