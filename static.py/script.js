
const form = document.getElementById("questionForm");
const input = document.getElementById("question");
const chat = document.getElementById("chat");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const statusBadge = document.getElementById("statusBadge");
const backendStatus = document.getElementById("backendStatus");
const loading = document.getElementById("loading");
const errorMessage = document.getElementById("errorMessage");


// --------------------------------------------------
// 1. WELCOME SCREEN
// --------------------------------------------------

const welcomeHTML = `
    <div class="welcome">
        <h2>What are you studying today?</h2>
        <p>Choose a question or type your own.</p>

        <button type="button" class="suggestion">
            Explain linear regression
        </button>

        <button type="button" class="suggestion">
            What is a decision tree?
        </button>

        <button type="button" class="suggestion">
            Explain confusion matrix
        </button>
    </div>
`;


// --------------------------------------------------
// 2. CHECK BACKEND STATUS
// --------------------------------------------------

async function checkBackendStatus() {
    try {
        const response = await fetch("/api/status");
        const data = await response.json();

        if (!response.ok) {
            throw new Error("Unable to check backend status.");
        }

        if (data.ready) {
            statusBadge.textContent = "● Ready to learn";
            backendStatus.textContent = "● AI Assistant Ready";
        } else {
            statusBadge.textContent = "● Setup required";
            backendStatus.textContent = "● AI Assistant Not Ready";

            showError(
                data.error || "The RAG system is not ready."
            );
        }

    } catch (error) {
        statusBadge.textContent = "● Connection error";
        backendStatus.textContent = "● Backend unavailable";

        showError(
            "Cannot connect to the backend. " +
            "Make sure server.py is running."
        );
    }
}


// --------------------------------------------------
// 3. DISPLAY ERROR MESSAGE
// --------------------------------------------------

function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
    }
}


// --------------------------------------------------
// 4. ADD CHAT MESSAGE
// --------------------------------------------------

function addMessage(role, text, sources = []) {
    const message = document.createElement("div");
    message.className = `message ${role}`;

    const label = document.createElement("div");
    label.className = "label";

    label.textContent =
        role === "user"
            ? "You"
            : "AI/ML Study Assistant";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // Use textContent to display text safely
    bubble.textContent = text;

    message.append(label, bubble);

    // Display PDF sources
    if (sources.length > 0) {
        const sourceBox = document.createElement("div");
        sourceBox.className = "sources";
        sourceBox.textContent = "Sources from your notes:";

        sources.forEach(source => {
            const item = document.createElement("div");
            item.className = "source-item";

            item.textContent =
                `📄 ${source.source || "Unknown"} | ` +
                `Page: ${source.page ?? "Unknown"}`;

            sourceBox.appendChild(item);
        });

        message.appendChild(sourceBox);
    }

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;

    return message;
}


// --------------------------------------------------
// 5. ASK QUESTION TO THE RAG BACKEND
// --------------------------------------------------

async function askQuestion(question) {
    question = question.trim();

    if (!question || sendBtn.disabled) {
        return;
    }

    // Remove welcome screen after first question
    chat.querySelector(".welcome")?.remove();

    // Clear old error
    showError("");

    // Display user's question
    addMessage("user", question);

    // Clear input field
    input.value = "";

    // Disable button while waiting
    sendBtn.disabled = true;
    sendBtn.textContent = "Thinking...";

    // Show loading indicator
    if (loading) {
        loading.hidden = false;
    }

    const loadingMessage = addMessage(
        "assistant",
        "Searching your notes and preparing an answer..."
    );

    try {
        // Send the question to server.py
        const response = await fetch("/api/ask", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                question: question
            })
        });

        const data = await response.json();

        // Handle backend errors
        if (!response.ok) {
            throw new Error(
                data.detail || "The server returned an error."
            );
        }

        // Remove temporary loading message
        loadingMessage.remove();

        // Display AI-generated answer and sources
        addMessage(
            "assistant",
            data.answer || "No answer was returned.",
            data.sources || []
        );

    } catch (error) {
        loadingMessage.remove();

        addMessage(
            "assistant",
            "Unable to get an answer: " + error.message
        );

    } finally {
        // Restore the button
        sendBtn.disabled = false;
        sendBtn.textContent = "Ask question ↑";

        if (loading) {
            loading.hidden = true;
        }

        input.focus();
        chat.scrollTop = chat.scrollHeight;
    }
}


// --------------------------------------------------
// 6. SUBMIT QUESTION USING THE FORM
// --------------------------------------------------

form.addEventListener("submit", function(event) {
    event.preventDefault();
    askQuestion(input.value);
});


// --------------------------------------------------
// 7. ENTER TO SEND, SHIFT + ENTER FOR NEW LINE
// --------------------------------------------------

input.addEventListener("keydown", function(event) {
    if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
    ) {
        event.preventDefault();
        form.requestSubmit();
    }
});


// --------------------------------------------------
// 8. SUGGESTED QUESTIONS
// --------------------------------------------------

chat.addEventListener("click", function(event) {
    const button = event.target.closest(".suggestion");

    if (button) {
        askQuestion(button.textContent);
    }
});


// --------------------------------------------------
// 9. START A NEW CHAT
// --------------------------------------------------

clearBtn.addEventListener("click", function() {
    // Avoid clearing the chat while a request is running
    if (sendBtn.disabled) {
        return;
    }

    chat.innerHTML = welcomeHTML;

    input.value = "";
    showError("");
    input.focus();
});


// --------------------------------------------------
// 10. INITIALIZE APPLICATION
// --------------------------------------------------

checkBackendStatus();
