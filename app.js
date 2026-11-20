// Baza słów i zestawy używane w aktualnych sesjach.
let vocabularyByLevel = {};
let words = [];
let learningWords = [];
let quizWords = [];

// Stan nauki i quizu.
let currentIndex = 0;
let quizIndex = 0;
let quizScore = 0;
let answerChecked = false;
let mistakenWords = [];
let canAcceptAnswer = false;

// Ekrany aplikacji.
const menuScreen = document.getElementById("menu-screen");
const learnScreen = document.getElementById("learn-screen");
const quizScreen = document.getElementById("quiz-screen");

// Wybór poziomu.
const levelSelect = document.getElementById("level-select");
const wordCount = document.getElementById("word-count");

// Elementy trybu nauki.
const polishWord = document.getElementById("polish-word");
const englishWord = document.getElementById("english-word");
const pronounceButton = document.getElementById("pronounce-button");
const learnButton = document.getElementById("learn-button");
const nextButton = document.getElementById("next-button");
const learnBackButton = document.getElementById("learn-back-button");

// Elementy quizu.
const quizButton = document.getElementById("quiz-button");
const quizWord = document.getElementById("quiz-word");
const quizCounter = document.getElementById("quiz-counter");
const quizScoreDisplay = document.getElementById("quiz-score");
const quizForm = document.getElementById("quiz-form");
const answerInput = document.getElementById("answer-input");
const checkButton = document.getElementById("check-button");
const quizFeedback = document.getElementById("quiz-feedback");
const quizNextButton = document.getElementById("quiz-next-button");
const quizBackButton = document.getElementById("quiz-back-button");
const reviewButton = document.getElementById("review-button");
const statisticsDisplay = document.getElementById("statistics-display");
const acceptAnswerButton = document.getElementById("accept-answer-button");
const practiceButton = document.getElementById("practice-button");
// Wczytanie zapisanych statystyk i własnych synonimów.
let statistics = loadStatistics();
let savedSynonyms = loadSavedSynonyms();

// Wczytuje słownictwo z pliku JSON.
async function loadVocabulary() {
    learnButton.disabled = true;
    quizButton.disabled = true;
    levelSelect.disabled = true;

    wordCount.textContent = "Loading vocabulary...";

    try {
        const response = await fetch("./vocabulary.json");

        if (!response.ok) {
            throw new Error("Could not load vocabulary.json.");
        }

        const data = await response.json();

        if (!data || typeof data.levels !== "object" || !data.levels) {
            throw new Error("The vocabulary file has an invalid format.");
        }

        vocabularyByLevel = data.levels;

        updateLevel();
        levelSelect.disabled = false;
    } catch (error) {
        console.error(error);

        wordCount.textContent =
            "Could not load vocabulary. Check the file and refresh.";
    }
}
// Przyciski wyboru ćwiczeń gramatycznych.
const verbTensesButton = document.getElementById("verb-tenses-button");
const casesButton = document.getElementById("cases-button");
const mixedGrammarButton = document.getElementById("mixed-grammar-button");

// Wspólny ekran ćwiczeń gramatycznych.
const grammarScreen = document.getElementById("grammar-screen");
const grammarTitle = document.getElementById("grammar-title");
const grammarCounter = document.getElementById("grammar-counter");
const grammarScoreDisplay = document.getElementById("grammar-score");
const grammarPrompt = document.getElementById("grammar-prompt");
const grammarForm = document.getElementById("grammar-form");
const grammarAnswer = document.getElementById("grammar-answer");
const grammarCheckButton = document.getElementById("grammar-check-button");
const grammarFeedback = document.getElementById("grammar-feedback");
const grammarExplanation = document.getElementById("grammar-explanation");
const grammarNextButton = document.getElementById("grammar-next-button");
const grammarBackButton = document.getElementById("grammar-back-button");

// Stan aktualnej sesji gramatycznej.
let grammarExercises = [];
let grammarIndex = 0;
let grammarScore = 0;
let grammarAnswerChecked = false;

// Pozwala odrzucić wynik pobierania po wyjściu z ekranu.
let grammarLoadId = 0;

// Wczytuje ćwiczenia wybranego trybu i poziomu.
async function startGrammar(fileName, title) {
    const currentLoadId = ++grammarLoadId;
    const selectedLevel = levelSelect.value;

    grammarExercises = [];
    grammarIndex = 0;
    grammarScore = 0;
    grammarAnswerChecked = false;

    showScreen(grammarScreen);

    grammarTitle.textContent = selectedLevel + " · " + title;
    grammarCounter.textContent = "";
    grammarScoreDisplay.textContent = "";
    grammarPrompt.textContent = "Loading exercises...";
    grammarFeedback.textContent = "";
    grammarExplanation.textContent = "";

    grammarForm.hidden = true;
    grammarNextButton.hidden = true;
    grammarNextButton.disabled = true;

    try {
        const response = await fetch("./" + fileName);

        if (!response.ok) {
            throw new Error("Could not load " + fileName);
        }

        const data = await response.json();

        // Użytkownik mógł wrócić do menu podczas pobierania.
        if (currentLoadId !== grammarLoadId) {
            return;
        }

        const entries = data?.[selectedLevel];

        if (!Array.isArray(entries)) {
            throw new Error("Missing exercises for " + selectedLevel);
        }

        const validEntries = entries.filter(function (entry) {
            return (
                entry !== null &&
                typeof entry === "object" &&
                typeof entry.prompt === "string" &&
                Array.isArray(entry.answers) &&
                entry.answers.length > 0 &&
                entry.answers.every(function (answer) {
                    return (
                        typeof answer === "string" &&
                        normalizeAnswer(answer) !== ""
                    );
                }) &&
                typeof entry.explanation === "string"
            );
        });

        if (validEntries.length === 0) {
            grammarPrompt.textContent =
                "No exercises available for this level.";
            return;
        }

        grammarExercises = shuffleWords(validEntries).slice(0, 10);

        grammarForm.hidden = false;
        grammarNextButton.hidden = false;

        showGrammarExercise();
    } catch (error) {
        if (currentLoadId !== grammarLoadId) {
            return;
        }

        console.error(error);

        grammarPrompt.textContent = "Could not load exercises.";
        grammarFeedback.textContent =
            "Check that " + fileName + " is in the app folder.";
    }
}

// Wyświetla ćwiczenie i zeruje pole odpowiedzi.
function showGrammarExercise() {
    const exercise = grammarExercises[grammarIndex];

    grammarCounter.textContent =
        "Exercise " + (grammarIndex + 1) +
        " / " + grammarExercises.length;

    grammarScoreDisplay.textContent =
        "Correct answers: " + grammarScore;

    grammarPrompt.textContent = exercise.prompt;
    grammarFeedback.textContent = "";
    grammarExplanation.textContent = "";

    grammarAnswer.value = "";
    grammarAnswer.readOnly = false;
    grammarAnswerChecked = false;

    grammarCheckButton.disabled = false;
    grammarNextButton.disabled = true;

    grammarNextButton.textContent =
        grammarIndex === grammarExercises.length - 1
            ? "Show result"
            : "Next exercise";

    grammarAnswer.focus();
}

// Akceptuje każdą poprawną odpowiedź wymienioną w pliku JSON.
function checkGrammarAnswer(event) {
    event.preventDefault();

    if (
        grammarAnswerChecked ||
        grammarIndex >= grammarExercises.length
    ) {
        return;
    }

    const userAnswer = normalizeAnswer(grammarAnswer.value);

    if (userAnswer === "") {
        grammarFeedback.textContent = "Please enter an answer.";
        return;
    }

    const exercise = grammarExercises[grammarIndex];

    const isCorrect = exercise.answers.some(function (answer) {
        return normalizeAnswer(answer) === userAnswer;
    });

    if (isCorrect) {
        grammarScore = grammarScore + 1;
        grammarFeedback.textContent = "Correct!";
    } else {
        grammarFeedback.textContent =
            "Accepted answers: " + exercise.answers.join(" / ");
    }

    // Wyjaśnienie pokazujemy dopiero po odpowiedzi.
    grammarExplanation.textContent = exercise.explanation;

    grammarScoreDisplay.textContent =
        "Correct answers: " + grammarScore;

    grammarAnswerChecked = true;
    grammarAnswer.readOnly = true;
    grammarCheckButton.disabled = true;
    grammarNextButton.disabled = false;
}

// Przechodzi do kolejnego ćwiczenia lub wyniku.
function nextGrammarExercise() {
    if (
        !grammarAnswerChecked ||
        grammarIndex >= grammarExercises.length
    ) {
        return;
    }

    grammarIndex = grammarIndex + 1;

    if (grammarIndex >= grammarExercises.length) {
        showGrammarResult();
        return;
    }

    showGrammarExercise();
}

// Pokazuje wynik sesji gramatycznej.
function showGrammarResult() {
    grammarCounter.textContent = "Session complete";
    grammarPrompt.textContent = "Your result";

    grammarFeedback.textContent =
        grammarScore + " / " +
        grammarExercises.length + " correct answers";

    grammarExplanation.textContent = "";

    grammarForm.hidden = true;
    grammarNextButton.hidden = true;
}

// Powrót unieważnia również trwające pobieranie ćwiczeń.
function leaveGrammar() {
    grammarLoadId = grammarLoadId + 1;
    showMenu();
}

// Podłączenie trzech trybów.
verbTensesButton.addEventListener("click", function () {
    startGrammar("grammar_verb_tenses.json", "Verb Tenses");
});

casesButton.addEventListener("click", function () {
    startGrammar("grammar_cases.json", "Noun and Adjective Cases");
});

mixedGrammarButton.addEventListener("click", function () {
    startGrammar("grammar_mixed.json", "Mixed Grammar");
});

grammarForm.addEventListener("submit", checkGrammarAnswer);
grammarNextButton.addEventListener("click", nextGrammarExercise);
grammarBackButton.addEventListener("click", leaveGrammar);
const tutorialButton = document.getElementById("tutorial-button");
const tutorialScreen = document.getElementById("tutorial-screen");
const tutorialTitle = document.getElementById("tutorial-title");
const tutorialSelect = document.getElementById("tutorial-select");
const tutorialStatus = document.getElementById("tutorial-status");
const tutorialContent = document.getElementById("tutorial-content");
const tutorialBackButton = document.getElementById("tutorial-back-button");

let tutorialLessons = [];
let tutorialLoadId = 0;

// Wczytuje lekcje dla poziomu wybranego w menu.
async function startTutorial() {
    const currentLoadId = ++tutorialLoadId;
    const selectedLevel = levelSelect.value;

    showScreen(tutorialScreen);

    tutorialTitle.textContent =
        selectedLevel + " · Grammar Tutorial";

    tutorialLessons = [];
    tutorialSelect.replaceChildren();
    tutorialSelect.disabled = true;
    tutorialContent.replaceChildren();
    tutorialStatus.textContent = "Loading tutorial...";

    try {
        const response = await fetch("./grammar_tutorial.json");

        if (!response.ok) {
            throw new Error("Could not load grammar_tutorial.json.");
        }

        const data = await response.json();

        if (currentLoadId !== tutorialLoadId) {
            return;
        }

        const lessons = data?.[selectedLevel];

        if (!Array.isArray(lessons)) {
            throw new Error("Missing lessons for " + selectedLevel);
        }

        tutorialLessons = lessons.filter(function (lesson) {
            return (
                lesson !== null &&
                typeof lesson === "object" &&
                typeof lesson.title === "string" &&
                typeof lesson.rule === "string"
            );
        });

        if (tutorialLessons.length === 0) {
            tutorialStatus.textContent =
                "No lessons available for this level.";
            return;
        }

        tutorialLessons.forEach(function (lesson, index) {
            const option = document.createElement("option");

            option.value = String(index);
            option.textContent = lesson.title;

            tutorialSelect.appendChild(option);
        });

        tutorialSelect.disabled = false;
        tutorialStatus.textContent = "";

        showTutorialLesson();
    } catch (error) {
        if (currentLoadId !== tutorialLoadId) {
            return;
        }

        console.error(error);

        tutorialStatus.textContent =
            "Could not load tutorial. Check grammar_tutorial.json.";
    }
}

// Wyświetla tekst i zamienia **fragment** na pogrubienie.
// Korzysta z węzłów tekstowych, bez wstawiania HTML z pliku JSON.
// Bezpiecznie wyświetla pogrubienia, końcówki i zmiany tematu.
function appendTutorialText(element, text) {
    const pattern =
        /(\[\[(?:end|stem):[^\]]*\]\]|\*\*[\s\S]+?\*\*)/g;

    const parts = String(text).split(pattern);

    parts.forEach(function (part) {
        const marker = part.match(/^\[\[(end|stem):(.*?)\]\]$/);

        if (marker) {
            const span = document.createElement("span");

            span.className =
                marker[1] === "end"
                    ? "grammar-ending"
                    : "grammar-stem";

            span.textContent = marker[2];

            span.title =
                marker[1] === "end"
                    ? "Ending or verb-form segment"
                    : "Changed stem";

            element.appendChild(span);
        } else if (
            part.startsWith("**") &&
            part.endsWith("**")
        ) {
            const strong = document.createElement("strong");

            // Obsługuje także końcówkę wewnątrz pogrubienia.
            appendTutorialText(strong, part.slice(2, -2));
            element.appendChild(strong);
        } else {
            element.appendChild(document.createTextNode(part));
        }
    });
}

// Wyświetla wybraną lekcję.
// Tworzy tabelę z danych tutorialu.
function appendTutorialTable(parent, tableData) {
    if (
        !tableData ||
        !Array.isArray(tableData.headers) ||
        !Array.isArray(tableData.rows)
    ) {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "tutorial-table-wrapper";

    const table = document.createElement("table");
    table.className = "tutorial-table";

    if (typeof tableData.title === "string") {
        const caption = document.createElement("caption");

        caption.textContent = tableData.title;
        table.appendChild(caption);
    }

    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");

    tableData.headers.forEach(function (header) {
        const cell = document.createElement("th");

        cell.scope = "col";
        appendTutorialText(cell, header);
        headerRow.appendChild(cell);
    });

    head.appendChild(headerRow);
    table.appendChild(head);

    const body = document.createElement("tbody");

    tableData.rows.forEach(function (row) {
        if (!Array.isArray(row)) {
            return;
        }

        const tableRow = document.createElement("tr");

        row.forEach(function (value) {
            const cell = document.createElement("td");

            appendTutorialText(cell, value);
            tableRow.appendChild(cell);
        });

        body.appendChild(tableRow);
    });

    table.appendChild(body);
    wrapper.appendChild(table);
    parent.appendChild(wrapper);
}

// Wyświetla lekcję, przykłady i podsumowanie końcówek.
function showTutorialLesson() {
    const lesson =
        tutorialLessons[Number(tutorialSelect.value)];

    tutorialContent.replaceChildren();

    if (!lesson) {
        return;
    }

    const heading = document.createElement("h3");
    heading.textContent = lesson.title;
    tutorialContent.appendChild(heading);

    const rule = document.createElement("p");
    appendTutorialText(rule, lesson.rule);
    tutorialContent.appendChild(rule);

    const legend = document.createElement("p");
    legend.className = "grammar-legend";

    appendTutorialText(
        legend,
        "[[end:Blue + underline]]: ending or verb-form segment. " +
        "[[stem:Amber + underline]]: changed stem. " +
        "∅: no overt ending; do not pronounce this symbol."
    );

    tutorialContent.appendChild(legend);

    if (Array.isArray(lesson.tables)) {
        lesson.tables.forEach(function (tableData) {
            appendTutorialTable(tutorialContent, tableData);
        });
    }

    if (
        Array.isArray(lesson.examples) &&
        lesson.examples.length > 0
    ) {
        const examplesHeading = document.createElement("h4");
        examplesHeading.textContent = "Examples";
        tutorialContent.appendChild(examplesHeading);

        lesson.examples.forEach(function (example) {
            if (
                !example ||
                typeof example.polish !== "string" ||
                typeof example.english !== "string"
            ) {
                return;
            }

            const block = document.createElement("div");
            block.className = "tutorial-example";

            const polish = document.createElement("p");
            polish.lang = "pl";
            appendTutorialText(polish, example.polish);

            const english = document.createElement("p");
            english.lang = "en";
            appendTutorialText(english, example.english);

            block.appendChild(polish);
            block.appendChild(english);
            tutorialContent.appendChild(block);
        });
    }

    // Podsumowanie pojawia się na końcu lekcji.
    if (
        Array.isArray(lesson.endingTables) &&
        lesson.endingTables.length > 0
    ) {
        const summary = document.createElement("section");
        summary.className = "grammar-ending-summary";

        const summaryHeading = document.createElement("h4");
        summaryHeading.textContent = "Endings summary";
        summary.appendChild(summaryHeading);

        if (lesson.endingNote) {
            const note = document.createElement("p");

            note.textContent = lesson.endingNote;
            summary.appendChild(note);
        }

        lesson.endingTables.forEach(function (tableData) {
            appendTutorialTable(summary, tableData);
        });

        tutorialContent.appendChild(summary);
    }
}

// Powrót unieważnia trwające pobieranie tutorialu.
function leaveTutorial() {
    tutorialLoadId = tutorialLoadId + 1;
    showMenu();
}

tutorialButton.addEventListener("click", startTutorial);
tutorialSelect.addEventListener("change", showTutorialLesson);
tutorialBackButton.addEventListener("click", leaveTutorial);

// Wybiera słowa przypisane do aktualnego poziomu.
function updateLevel() {
    const selectedLevel = levelSelect.value;
    const entries = vocabularyByLevel[selectedLevel] || [];

    words = entries.map(function (entry) {
        return {
            polish: entry.polish[0],
            english: entry.english,
            synonyms: entry.polish.slice(1)
        };
    });

    // Zmiana poziomu zeruje poprzednie zestawy.
    learningWords = [];
    quizWords = [];

    currentIndex = 0;
    quizIndex = 0;
    quizScore = 0;
    answerChecked = false;

    wordCount.textContent =
        selectedLevel + ": " + words.length + " words";

    learnButton.disabled = words.length === 0;
    quizButton.disabled = words.length === 0;

    try {
        localStorage.setItem("selectedLevel", selectedLevel);
    } catch (error) {
        console.warn("Could not save selected level:", error);
    }
}

// Miesza kopię tablicy, zachowując oryginalną kolejność bazy.
function shuffleWords(sourceWords) {
    const shuffledWords = [...sourceWords];

    for (let i = shuffledWords.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));

        const temporaryWord = shuffledWords[i];
        shuffledWords[i] = shuffledWords[randomIndex];
        shuffledWords[randomIndex] = temporaryWord;
    }

    return shuffledWords;
}

// Wczytuje własne synonimy zapisane w przeglądarce.
function loadSavedSynonyms() {
    try {
        const savedText = localStorage.getItem("savedSynonyms");

        if (savedText !== null) {
            const saved = JSON.parse(savedText);

            if (
                saved !== null &&
                typeof saved === "object" &&
                !Array.isArray(saved) &&
                Object.values(saved).every(function (answers) {
                    return Array.isArray(answers) &&
                        answers.every(function (answer) {
                            return typeof answer === "string" &&
                                normalizeAnswer(answer) !== "";
                        });
                })
            ) {
                return saved;
            }
        }
    } catch (error) {
        console.warn("Could not read synonyms:", error);
    }

    return {};
}

// Tworzy klucz przypisujący własne synonimy do konkretnego hasła.
function getWordKey(word) {
    return JSON.stringify([
        word.english,
        word.polish
    ]);
}

// Pokazuje wyłącznie wybrany ekran.
function showScreen(screen) {
    menuScreen.hidden = true;
    learnScreen.hidden = true;
    quizScreen.hidden = true;
    grammarScreen.hidden = true;
    tutorialScreen.hidden = true;

    screen.hidden = false;
}

// Zapisuje wynik ukończonej sesji.
function saveSessionResult() {
    statistics.sessions = statistics.sessions + 1;
    statistics.correct = statistics.correct + quizScore;
    statistics.answered = statistics.answered + quizWords.length;

    try {
        const savedText = JSON.stringify(statistics);

        localStorage.setItem("quizStatistics", savedText);
    } catch (error) {
        console.error("Could not save statistics:", error);

        quizFeedback.textContent +=
            " Statistics could not be saved on this device.";
    }
}

// Wraca do menu i aktualizuje widoczne statystyki.
function showMenu() {
    showStatistics();
    showScreen(menuScreen);
}

// Losuje do 10 słów do nauki.
function startLearning() {
    if (words.length === 0) {
        return;
    }

    learningWords = shuffleWords(words).slice(0, 10);
    currentIndex = 0;

    showScreen(learnScreen);
    showWord();
}
// Odczytuje aktualne polskie słowo.
function pronounceWord() {
    if (
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
    ) {
        alert("Speech is not supported in this browser.");
        return;
    }

    const currentWord = learningWords[currentIndex];

    if (!currentWord) {
        return;
    }

    // Zatrzymuje poprzedni odczyt.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(currentWord.polish);

    utterance.lang = "pl-PL";
    utterance.rate = 0.8;

    // Wybiera polski głos, jeśli jest dostępny.
    const polishVoice = window.speechSynthesis
        .getVoices()
        .find(function (voice) {
            return /^pl(?:-|_ |$)/i.test(voice.lang.replace("_", "-"));
        });

    if (polishVoice) {
        utterance.voice = polishVoice;
    }

    window.speechSynthesis.speak(utterance);
}
// Wyświetla polskie słowo i angielskie tłumaczenie.
function showWord() {
    const currentWord = learningWords[currentIndex];

    polishWord.textContent = currentWord.polish;
    englishWord.textContent = currentWord.english;

    if (currentIndex === learningWords.length - 1) {
        nextButton.textContent = "Practice these words";
    } else {
        nextButton.textContent = "Next word";
    }
}

// Po ostatnim słowie losuje nowy zestaw do nauki.
function nextWord() {
    // Po ostatnim słowie uruchamia quiz z tego zestawu.
    if (currentIndex === learningWords.length - 1) {
        practiceLearningWords();
        return;
    }

    currentIndex = currentIndex + 1;
    showWord();
}

// Rozpoczyna nowy quiz z maksymalnie 10 pytaniami.
function startQuiz() {
    if (words.length === 0) {
        return;
    }

    quizWords = shuffleWords(words).slice(0, 10);

    quizIndex = 0;
    quizScore = 0;
    mistakenWords = [];
    reviewButton.hidden = true;
    answerChecked = false;

    quizForm.hidden = false;
    quizNextButton.hidden = false;

    showScreen(quizScreen);
    showQuizWord();
}

// Wyświetla pytanie i przygotowuje pole odpowiedzi.
function showQuizWord() {
    const currentWord = quizWords[quizIndex];

    quizWord.textContent = currentWord.english;

    quizCounter.textContent =
        "Question " + (quizIndex + 1) + " / " + quizWords.length;

    quizScoreDisplay.textContent = "Correct answers: " + quizScore;

    answerInput.value = "";
    answerInput.readOnly = false;
    quizFeedback.textContent = "";

    answerChecked = false;
    checkButton.disabled = false;
    quizNextButton.disabled = true;

    if (quizIndex === quizWords.length - 1) {
        quizNextButton.textContent = "Show result";
    } else {
        quizNextButton.textContent = "Next word";
    }

    answerInput.focus();

    canAcceptAnswer = false;
    acceptAnswerButton.hidden = true;
}

// Ujednolica wielkość liter, zapis znaków i odstępy.
// Polskie znaki pozostają istotne przy sprawdzaniu odpowiedzi.
function normalizeAnswer(text) {
    return text
        .normalize("NFC")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// Sprawdza główne tłumaczenie, synonimy z bazy i własne synonimy.
function checkAnswer(event) {
    event.preventDefault();

    if (answerChecked || quizIndex >= quizWords.length) {
        return;
    }

    const userAnswer = normalizeAnswer(answerInput.value);

    if (userAnswer === "") {
        quizFeedback.textContent = "Please enter an answer.";
        return;
    }

    const currentWord = quizWords[quizIndex];

    const wordKey = getWordKey(currentWord);
    const additionalAnswers = savedSynonyms[wordKey] || [];

    const acceptedAnswers = [
        currentWord.polish,
        ...currentWord.synonyms,
        ...additionalAnswers
    ];

    const isCorrect = acceptedAnswers.some(function (answer) {
        return normalizeAnswer(answer) === userAnswer;
    });

    if (isCorrect) {
        quizScore = quizScore + 1;
        quizFeedback.textContent = "Correct!";
    } else {
        mistakenWords.push(currentWord);
        canAcceptAnswer = true;
        acceptAnswerButton.hidden = false;

        quizFeedback.textContent =
            "Accepted answers: " + acceptedAnswers.join(" / ");
    }

    quizScoreDisplay.textContent = "Correct answers: " + quizScore;

    // Jedno pytanie można ocenić tylko raz.
    answerChecked = true;
    answerInput.readOnly = true;
    checkButton.disabled = true;
    quizNextButton.disabled = false;
}

// Pozwala uznać własną odpowiedź i zapisać ją jako synonim.
function acceptCurrentAnswer() {
    if (!canAcceptAnswer) {
        return;
    }

    const currentWord = quizWords[quizIndex];
    const userAnswer = normalizeAnswer(answerInput.value);
    const wordKey = getWordKey(currentWord);

    if (userAnswer === "") {
        return;
    }

    if (!savedSynonyms[wordKey]) {
        savedSynonyms[wordKey] = [];
    }

    if (!savedSynonyms[wordKey].includes(userAnswer)) {
        savedSynonyms[wordKey].push(userAnswer);
    }

    quizScore = quizScore + 1;

    mistakenWords = mistakenWords.filter(function (word) {
        return word !== currentWord;
    });

    quizScoreDisplay.textContent = "Correct answers: " + quizScore;

    canAcceptAnswer = false;
    acceptAnswerButton.hidden = true;

    try {
        localStorage.setItem(
            "savedSynonyms",
            JSON.stringify(savedSynonyms)
        );

        quizFeedback.textContent =
            "Marked as correct. Your answer has been saved.";
    } catch (error) {
        console.error("Could not save synonym:", error);

        quizFeedback.textContent =
            "Marked as correct, but could not save for future visits.";
    }
}

// Wczytuje statystyki zapisane w przeglądarce.
function loadStatistics() {
    try {
        const savedText = localStorage.getItem("quizStatistics");

        if (savedText !== null) {
            const saved = JSON.parse(savedText);

            if (
                saved !== null &&
                Number.isSafeInteger(saved.sessions) &&
                Number.isSafeInteger(saved.correct) &&
                Number.isSafeInteger(saved.answered) &&
                saved.sessions >= 0 &&
                saved.correct >= 0 &&
                saved.answered >= saved.correct
            ) {
                return saved;
            }
        }
    } catch (error) {
        console.warn("Could not read statistics:", error);
    }

    return {
        sessions: 0,
        correct: 0,
        answered: 0
    };
}

// Przechodzi dalej dopiero po sprawdzeniu odpowiedzi.
function nextQuizWord() {
    if (!answerChecked || quizIndex >= quizWords.length) {
        return;
    }

    quizIndex = quizIndex + 1;

    if (quizIndex >= quizWords.length) {
        showQuizResult();
        return;
    }

    showQuizWord();
}

// Kończy sesję i pokazuje wynik.
function showQuizResult() {
    canAcceptAnswer = false;
    acceptAnswerButton.hidden = true;

    quizCounter.textContent = "Session complete";
    quizWord.textContent = "Your result";

    quizFeedback.textContent =
        quizScore + " / " + quizWords.length + " correct answers";

    quizForm.hidden = true;
    quizNextButton.hidden = true;
    reviewButton.hidden = mistakenWords.length === 0;

    saveSessionResult();
}

// Wyświetla łączne statystyki w menu.
function showStatistics() {
    statisticsDisplay.textContent =
        "Completed sessions: " + statistics.sessions +
        " | Correct answers: " + statistics.correct +
        " / " + statistics.answered;
}

// Uruchamia quiz ze słów błędnie przetłumaczonych w ostatniej sesji.
function reviewMistakes() {
    if (mistakenWords.length === 0) {
        return;
    }

    quizWords = shuffleWords(mistakenWords);

    mistakenWords = [];
    quizIndex = 0;
    quizScore = 0;
    answerChecked = false;

    reviewButton.hidden = true;
    quizForm.hidden = false;
    quizNextButton.hidden = false;

    showQuizWord();
}
// Rozpoczyna quiz ze słów z aktualnego zestawu nauki.
function practiceLearningWords() {
    if (learningWords.length === 0) {
        return;
    }

    quizWords = shuffleWords(learningWords);

    quizIndex = 0;
    quizScore = 0;
    mistakenWords = [];
    answerChecked = false;
    canAcceptAnswer = false;

    reviewButton.hidden = true;
    acceptAnswerButton.hidden = true;
    quizForm.hidden = false;
    quizNextButton.hidden = false;

    showScreen(quizScreen);
    showQuizWord();
}
// Obsługa przycisków i formularza.
learnButton.addEventListener("click", startLearning);
quizButton.addEventListener("click", startQuiz);

nextButton.addEventListener("click", nextWord);
quizNextButton.addEventListener("click", nextQuizWord);

learnBackButton.addEventListener("click", showMenu);
quizBackButton.addEventListener("click", showMenu);

reviewButton.addEventListener("click", reviewMistakes);
quizForm.addEventListener("submit", checkAnswer);
levelSelect.addEventListener("change", updateLevel);
acceptAnswerButton.addEventListener("click", acceptCurrentAnswer);
pronounceButton.addEventListener("click", pronounceWord);
practiceButton.addEventListener("click", practiceLearningWords);
// Przywraca ostatnio wybrany poziom.
try {
    const savedLevel = localStorage.getItem("selectedLevel");

    if (["A1", "A2", "B1", "B2"].includes(savedLevel)) {
        levelSelect.value = savedLevel;
    }
} catch (error) {
    console.warn("Could not read selected level:", error);
}

// Uruchomienie aplikacji.
showMenu();
loadVocabulary();
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker
            .register("./service-worker.js")
            .then(function () {
                console.log("Offline support registered.");
            })
            .catch(function (error) {
                console.error(
                    "Could not register offline support:",
                    error
                );
            });
    });
}