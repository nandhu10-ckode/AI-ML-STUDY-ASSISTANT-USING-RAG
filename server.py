
from pathlib import Path
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq

# Project folder and API key
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="AI/ML Study Assistant")

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)


class QuestionRequest(BaseModel):
    question: str


@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/api/health")
def health():
    return {"status": "Backend is running"}


# Load the RAG components
def create_rag():
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError(
            "GROQ_API_KEY missing. Check your .env file."
        )

    db_path = BASE_DIR / "vectorstore"

    if not db_path.exists():
        raise RuntimeError(
            "Vectorstore not found. Run ingest.py first."
        )

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    vectorstore = Chroma(
        persist_directory=str(db_path),
        embedding_function=embeddings
    )

    retriever = vectorstore.as_retriever(
        search_kwargs={"k": 4}
    )

    llm = ChatGroq(
        model="openai/gpt-oss-20b",
        temperature=0
    )

    return retriever, llm


try:
    retriever, llm = create_rag()
    startup_error = None
except Exception as error:
    retriever = None
    llm = None
    startup_error = str(error)


@app.get("/api/status")
def status():
    return {
        "ready": retriever is not None and llm is not None,
        "error": startup_error
    }


@app.post("/api/ask")
def ask(request: QuestionRequest):
    if retriever is None or llm is None:
        raise HTTPException(
            status_code=503,
            detail=startup_error or "RAG is not ready."
        )

    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a question."
        )

    try:
        documents = retriever.invoke(question)

        if not documents:
            return {
                "answer": (
                    "I could not find this information "
                    "in the uploaded notes."
                ),
                "sources": []
            }

        context = "\n\n".join(
            doc.page_content for doc in documents
        )

        prompt = f"""
You are an AI/ML study assistant.

Answer using only the information in the context.
If the answer is not present, say:
"I could not find this information in the uploaded notes."

Context:
{context}

Question:
{question}

Answer:
"""

        response = llm.invoke(prompt)

        sources = []
        seen = set()

        for doc in documents:
            source = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", "Unknown")
            key = (str(source), str(page))

            if key not in seen:
                seen.add(key)
                sources.append({
                    "source": str(source),
                    "page": str(page)
                })

        return {
            "answer": str(response.content),
            "sources": sources
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not generate answer: {error}"
        )
