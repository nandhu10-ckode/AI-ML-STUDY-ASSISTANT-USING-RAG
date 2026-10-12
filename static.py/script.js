
const form = document.getElementById("questionForm");
const input = document.getElementById("question");
const chat = document.getElementById("chat");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const welcomeHTML = `
    <div class="welcome">
        <h2>What are you studying today?</h2>
        <p>Choose a question or type your own.</p>
        <button class="suggestion">Explain linear regression</button>
        <button class="suggestion">What is a decision tree?</button>
        <button class="suggestion">Explain confusion matrix</button>
    </div>
`;

function addMessage(role, text, sources = []) {
    const message = document.createElement("div");
    message.className = `message ${role}`;

    const label = document.createElement("div");
    label.className = "label";
    label.textContent =
        role === "user" ? "You" : "AI/ML Study Assistant";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    message.append(label, bubble);

    if (sources.length > 0) {
        const sourceBox = document.createElement("div");
        sourceBox.className = "sources";
        sourceBox.textContent = "Sources from your notes:";

        sources.forEach(source => {
            const item = document.createElement("div");
            item.className = "source-item";
            item.textContent =
                `📄 ${source.source} | Page: ${source.page}`;
            sourceBox.appendChild(item);
        });

        message.appendChild(sourceBox);
    }

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;

    return message;
}

async function askQuestion(question) {
    question = question.trim();

    if (!question || sendBtn.disabled) return;

    chat.querySelector(".welcome")?.remove();
    addMessage("user", question);

    input.value = "";
    sendBtn.disabled = true;
    sendBtn.textContent = "Thinking...";

    const loading = addMessage(
        "assistant",
        "Searching your notes and preparing an answer..."
    );

    try {
        const response = await fetch("/api/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "The server returned an error."
            );
        }

        loading.remove();

        addMessage(
            "assistant",
            data.answer,
            data.sources || []
        );

    } catch (error) {
        loading.remove();

        addMessage(
            "assistant",
            "Unable to get an answer: " + error.message +
            "\n\nCheck your .env file, Groq API key, " +
            "vectorstore folder, and backend terminal."
        );
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Ask question ↑";
        input.focus();
    }
}

form.addEventListener("submit", event => {
    event.preventDefault();
    askQuestion(input.value);
});

input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

chat.addEventListener("click", event => {
    const button = event.target.closest(".suggestion");

    if (button) {
        askQuestion(button.textContent);
    }
});

clearBtn.addEventListener("click", () => {
    chat.innerHTML = welcomeHTML;
    input.value = "";
    input.focus();
});
