(function () {
    "use strict";

    const client = window.sharedVocabularyClient;

    const panel = document.getElementById("admin-vocabulary-panel");
    const search = document.getElementById("admin-word-search");
    const refreshButton = document.getElementById("admin-word-refresh");
    const status = document.getElementById("admin-word-status");
    const list = document.getElementById("admin-word-list");

    const form = document.getElementById("admin-word-form");
    const polishInput = document.getElementById("admin-word-polish");
    const englishInput = document.getElementById("admin-word-english");
    const synonymsInput = document.getElementById("admin-word-synonyms");
    const levelInput = document.getElementById("admin-word-level");
    const saveButton = document.getElementById("admin-word-save");
    const cancelButton = document.getElementById("admin-word-cancel");

    if (!client || !panel) {
        return;
    }

    let entries = [];
    let editingId = null;
    let isAdmin = false;
    let busy = false;
    let generation = 0;

    function clean(text) {
        return text.normalize("NFC").trim().replace(/\s+/g, " ");
    }

    function cancelEditing() {
        editingId = null;
        form.reset();
        form.hidden = true;
    }

    function setBusy(value) {
        busy = value;

        refreshButton.disabled = value;
        saveButton.disabled = value;
        cancelButton.disabled = value;

        [
            polishInput,
            englishInput,
            synonymsInput,
            levelInput
        ].forEach(function (input) {
            input.disabled = value;
        });

        list.querySelectorAll("button").forEach(function (button) {
            button.disabled = value;
        });
    }

    async function checkAdmin() {
        const { data, error } = await client.auth.getUser();

        if (error || !data.user) {
            return false;
        }

        const result = await client
            .from("vocabulary_editors")
            .select("role")
            .eq("user_id", data.user.id)
            .maybeSingle();

        if (result.error) {
            throw result.error;
        }

        return result.data?.role === "admin";
    }

    async function fetchEntries() {
        const rows = [];
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

            rows.push(...data);

            if (data.length < pageSize) {
                break;
            }
        }

        return rows;
    }

    // Odświeża również słowa używane przez naukę i quiz.
    function notifyVocabularyChanged() {
        window.dispatchEvent(
            new Event("shared-vocabulary-changed")
        );
    }

    function startEditing(entry) {
        if (busy || !isAdmin) {
            return;
        }

        editingId = entry.id;

        polishInput.value = entry.polish;
        englishInput.value = entry.english;
        synonymsInput.value = entry.synonyms.join("; ");
        levelInput.value = entry.level;

        form.hidden = false;
        form.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        polishInput.focus();
    }

    function renderList() {
        list.replaceChildren();

        if (!isAdmin) {
            return;
        }

        const query = clean(search.value).toLowerCase();

        const filtered = entries.filter(function (entry) {
            const text = [
                entry.level,
                entry.polish,
                entry.english,
                ...entry.synonyms
            ].join(" ").toLowerCase();

            return text.includes(query);
        });

        if (filtered.length === 0) {
            const message = document.createElement("p");
            message.textContent = "No matching words.";
            list.appendChild(message);
            return;
        }

        // Ogranicza liczbę elementów na ekranie telefonu.
        filtered.slice(0, 50).forEach(function (entry) {
            const card = document.createElement("div");
            card.className = "admin-word-card";

            const heading = document.createElement("strong");
            heading.textContent =
                entry.level + " · " +
                entry.polish + " — " + entry.english;

            card.appendChild(heading);

            if (entry.synonyms.length > 0) {
                const synonyms = document.createElement("p");
                synonyms.textContent =
                    "Synonyms: " + entry.synonyms.join("; ");

                card.appendChild(synonyms);
            }

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.disabled = busy;

            editButton.addEventListener("click", function () {
                startEditing(entry);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";
            deleteButton.className = "admin-delete-button";
            deleteButton.disabled = busy;

            deleteButton.addEventListener("click", function () {
                deleteEntry(entry);
            });

            card.appendChild(editButton);
            card.appendChild(deleteButton);
            list.appendChild(card);
        });

        if (filtered.length > 50) {
            const message = document.createElement("p");

            message.textContent =
                "Showing 50 of " + filtered.length +
                " words. Narrow your search.";

            list.appendChild(message);
        }
    }

    async function refreshList() {
        if (busy || !isAdmin) {
            return;
        }

        const version = generation;
        setBusy(true);
        status.textContent = "Loading words...";

        try {
            const rows = await fetchEntries();

            if (version !== generation || !isAdmin) {
                return;
            }

            entries = rows;
            renderList();

            status.textContent =
                "Shared words: " + entries.length;

        } catch (error) {
            console.error("Could not load admin list:", error);

            if (version === generation) {
                status.textContent =
                    "Could not load words. Check your connection.";
            }
        } finally {
            setBusy(false);
        }
    }

    async function deleteEntry(entry) {
        if (busy || !isAdmin) {
            return;
        }

        const confirmed = window.confirm(
            "Delete this word for everyone?\n\n" +
            entry.polish + " — " + entry.english
        );

        if (!confirmed) {
            return;
        }

        const version = generation;
        setBusy(true);
        status.textContent = "Deleting...";

        try {
            if (!(await checkAdmin())) {
                throw new Error("Administrator access required.");
            }

            if (version !== generation) {
                return;
            }

            const { data, error } = await client
                .from("shared_vocabulary")
                .delete()
                .eq("id", entry.id)
                .select("id")
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                throw new Error(
                    "The word was not found or access was denied."
                );
            }

            // Odświeża kopię słownika również po zmianie sesji.
            notifyVocabularyChanged();

            if (version !== generation) {
                return;
            }

            entries = entries.filter(function (word) {
                return word.id !== entry.id;
            });

            if (editingId === entry.id) {
                cancelEditing();
            }

            renderList();
            status.textContent = "Word deleted.";

        } catch (error) {
            console.error("Could not delete word:", error);

            if (version === generation) {
                status.textContent =
                    "Could not confirm deletion. Refresh the list.";
            }
        } finally {
            setBusy(false);
        }
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (busy || !isAdmin || !editingId) {
            return;
        }

        const polish = clean(polishInput.value);
        const english = clean(englishInput.value);
        const level = levelInput.value;

        const synonyms = [];
        const known = new Set([polish.toLowerCase()]);

        synonymsInput.value.split(";").forEach(function (text) {
            const value = clean(text);
            const key = value.toLowerCase();

            if (value && !known.has(key)) {
                synonyms.push(value);
                known.add(key);
            }
        });

        if (
            !polish ||
            !english ||
            polish.length > 150 ||
            english.length > 200 ||
            !["A1", "A2", "B1", "B2"].includes(level) ||
            synonyms.length > 20 ||
            synonyms.some(function (word) {
                return word.length > 150;
            })
        ) {
            status.textContent =
                "Check the fields. Use up to 20 synonyms.";
            return;
        }

        const id = editingId;
        const version = generation;
        const changes = { polish, english, synonyms, level };

        setBusy(true);
        status.textContent = "Saving changes...";

        try {
            if (!(await checkAdmin())) {
                throw new Error("Administrator access required.");
            }

            if (version !== generation) {
                return;
            }

            const { data, error } = await client
                .from("shared_vocabulary")
                .update(changes)
                .eq("id", id)
                .select("id")
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                throw new Error(
                    "The word was not found or access was denied."
                );
            }

            notifyVocabularyChanged();

            if (version !== generation) {
                return;
            }

            entries = entries.map(function (entry) {
                return entry.id === id
                    ? { ...entry, ...changes }
                    : entry;
            });

            cancelEditing();
            renderList();
            status.textContent = "Changes saved.";

        } catch (error) {
            console.error("Could not update word:", error);

            if (version === generation) {
                status.textContent =
                    error.code === "23505"
                        ? "This word and translation already exist at this level."
                        : "Could not confirm the change. Refresh the list.";
            }
        } finally {
            setBusy(false);
        }
    });

    async function refreshAdminAccess() {
        const version = ++generation;

        isAdmin = false;
        panel.hidden = true;
        panel.open = false;
        entries = [];
        list.replaceChildren();
        cancelEditing();
        status.textContent = "";

        try {
            const allowed = await checkAdmin();

            if (version !== generation) {
                return;
            }

            isAdmin = allowed;
            panel.hidden = !allowed;

        } catch (error) {
            console.warn("Could not check admin access:", error);
        }
    }

    search.addEventListener("input", renderList);

    refreshButton.addEventListener("click", refreshList);

    cancelButton.addEventListener("click", function () {
        if (!busy) {
            cancelEditing();
        }
    });

    panel.addEventListener("toggle", function () {
        if (panel.open) {
            refreshList();
        }
    });

    client.auth.onAuthStateChange(function () {
        generation++;
        isAdmin = false;
        panel.hidden = true;

        setTimeout(function () {
            refreshAdminAccess();
        }, 0);
    });

    window.addEventListener("online", refreshAdminAccess);

    refreshAdminAccess();
})();