// Osobny moduł logowania.
// Jego błąd nie zatrzymuje wcześniejszego uruchomienia app.js.
(function () {
    const loginForm = document.getElementById("login-form");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const loginButton = document.getElementById("login-button");
    const logoutButton = document.getElementById("logout-button");
    const authStatus = document.getElementById("auth-status");
    const editorStatus = document.getElementById("editor-status");

    let client = null;
    let viewVersion = 0;

    // W następnym kroku skorzysta z tego formularz dodawania słów.
    window.sharedVocabularyClient = null;

    function clearEditorStatus() {
        editorStatus.textContent = "";
    }

    // Wyświetla konto i odczytuje jego uprawnienia z bazy.
    async function updateAccountView(session) {
        const currentVersion = ++viewVersion;

        clearEditorStatus();

        if (!session) {
            loginForm.hidden = false;
            logoutButton.hidden = true;
            authStatus.textContent = "Sign in to contribute words.";
            return;
        }

        loginForm.hidden = true;
        logoutButton.hidden = false;

        authStatus.textContent =
            "Signed in as " + session.user.email;

        editorStatus.textContent = "Checking permissions...";

        try {
            const { data, error } = await client
                .from("vocabulary_editors")
                .select("role")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (currentVersion !== viewVersion) {
                return;
            }

            if (error) {
                throw error;
            }

            if (data?.role === "admin") {
                editorStatus.textContent =
                    "Administrator access: you can manage shared vocabulary.";
            } else if (data?.role === "editor") {
                editorStatus.textContent =
                    "Editor access: you can add shared vocabulary.";
            } else {
                editorStatus.textContent =
                    "This account does not have permission to add words.";
            }
        } catch (error) {
            if (currentVersion !== viewVersion) {
                return;
            }

            console.error("Could not check permissions:", error);

            editorStatus.textContent =
                "Could not check permissions. Check your connection.";
        }
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!client) {
            return;
        }

        loginButton.disabled = true;
        authStatus.textContent = "Signing in...";
        clearEditorStatus();

        try {
            const { error } = await client.auth.signInWithPassword({
                email: emailInput.value.trim(),
                password: passwordInput.value
            });

            if (error) {
                throw error;
            }

            passwordInput.value = "";

            // Widok zaktualizuje zdarzenie onAuthStateChange.
        } catch (error) {
            console.error("Sign-in failed:", error);

            authStatus.textContent =
                "Could not sign in. Check your email, password and connection.";
        } finally {
            loginButton.disabled = false;
        }
    });

    logoutButton.addEventListener("click", async function () {
        if (!client) {
            return;
        }

        logoutButton.disabled = true;

        try {
            const { error } = await client.auth.signOut({
                scope: "local"
            });

            if (error) {
                throw error;
            }

            passwordInput.value = "";
            await updateAccountView(null);
        } catch (error) {
            console.error("Sign-out failed:", error);

            authStatus.textContent =
                "Could not sign out. Please try again.";
        } finally {
            logoutButton.disabled = false;
        }
    });

    // Uruchomienie połączenia.
    try {
        const config = window.SUPABASE_CONFIG;

        if (
            !config?.url ||
            !config?.publishableKey ||
            !window.supabase?.createClient
        ) {
            throw new Error(
                "Missing Supabase configuration or library."
            );
        }

        client = window.supabase.createClient(
            config.url,
            config.publishableKey
        );

        window.sharedVocabularyClient = client;

        // Nie wykonujemy zapytań async bezpośrednio w callbacku.
        client.auth.onAuthStateChange(function (event, session) {
            // Unieważnia wcześniejsze sprawdzanie uprawnień.
            viewVersion++;

            setTimeout(function () {
                updateAccountView(session);
            }, 0);
        });

        loginButton.disabled = false;
    } catch (error) {
        console.error("Could not initialize sign-in:", error);

        authStatus.textContent =
            "Sign-in unavailable. Check your connection and configuration.";

        loginButton.disabled = true;
    }
})();