import { useState } from "react";
import jsPDF from "jspdf";

const WEBHOOK_URL =
  "https://ameensalahat.app.n8n.cloud/webhook/slide-summarizer";

const QUIZ_LENGTH = 5;

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [view, setView] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState("");

  const summary = view === "summary" && result ? result.summary : "";
  const quiz = view === "quiz" && result ? result.quiz : [];

  function resetResults() {
    setResult(null);
    setView("");
    setAnswers({});
    setSubmitted(false);
    setCurrent(0);
  }

  function handleFileChange(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setSelectedFile(null);
      resetResults();
      return;
    }

    setError("");
    resetResults();
    setSelectedFile(file);
  }

  function parseResult(data) {
    const parsed = JSON.parse(data[0].content[0].text);

    const [overview, ...points] = parsed.summary.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);

    const quiz = parsed.quiz.slice(0, QUIZ_LENGTH).map((q) => ({
      question: q.question,
      options: q.options,
      answer: q.options.indexOf(q.correctAnswer),
      explanation: q.explanation,
    }));

    return { summary: { overview, points }, quiz };
  }

  async function loadResult() {
    if (result) {
      return result;
    }

    const formData = new FormData();

    formData.append("data", selectedFile);

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Request failed.");
    }

    const data = await response.json();

    console.log("n8n Response:", data);

    const newResult = parseResult(data);

    setResult(newResult);

    return newResult;
  }

  async function handleSummarize() {
    if (!selectedFile) {
      setError("Please select a PDF file first.");
      return;
    }

    try {
      setError("");
      setView("");
      setLoading("summary");

      const { summary } = await loadResult();

      if (!summary) {
        throw new Error("Summary is empty.");
      }

      setView("summary");
    } catch (error) {
      console.error("Error:", error);

      setError("Failed to generate summary.");
    } finally {
      setLoading("");
    }
  }

  async function handleQuiz() {
    if (!selectedFile) {
      setError("Please select a PDF file first.");
      return;
    }

    try {
      setError("");
      setView("");
      setAnswers({});
      setSubmitted(false);
      setCurrent(0);
      setLoading("quiz");

      const { quiz } = await loadResult();

      if (quiz.length === 0) {
        throw new Error("Quiz is empty.");
      }

      setView("quiz");
    } catch (error) {
      console.error("Error:", error);

      setError("Failed to generate quiz.");
    } finally {
      setLoading("");
    }
  }

  function selectAnswer(questionIndex, optionIndex) {
    if (submitted) {
      return;
    }

    setAnswers({ ...answers, [questionIndex]: optionIndex });
  }

  function retryQuiz() {
    setAnswers({});
    setSubmitted(false);
    setCurrent(0);
  }

  function submitQuiz() {
    setSubmitted(true);
    setCurrent(0);
  }

  const currentQuestion = quiz[current];
  const score = quiz.filter((q, i) => answers[i] === q.answer).length;
  const allAnswered = quiz.length > 0 && Object.keys(answers).length === quiz.length;

  function downloadPDF() {
    if (!summary) {
      return;
    }

    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    let y = 20;

    function checkPageSpace(requiredHeight = 10) {
      if (y + requiredHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    }

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");

    doc.text("AI Lecture Summary", margin, y);

    y += 15;

    doc.setLineWidth(0.5);

    doc.line(
      margin,
      y,
      pageWidth - margin,
      y
    );

    y += 12;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    function writeHeading(heading) {
      checkPageSpace(20);

      y += 5;

      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");

      doc.text(heading, margin, y);

      y += 9;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
    }

    writeHeading("Overview");

    doc.splitTextToSize(summary.overview, maxWidth).forEach((line) => {
      checkPageSpace(7);

      doc.text(line, margin, y);

      y += 6;
    });

    y += 5;

    writeHeading("Key Points");

    summary.points.forEach((point) => {
      doc.splitTextToSize(point, maxWidth - 8).forEach((line, index) => {
        checkPageSpace(7);

        if (index === 0) {
          doc.text("•", margin, y);
        }

        doc.text(line, margin + 6, y);

        y += 6;
      });

      y += 2;
    });

    doc.save("lecture-summary.pdf");
  }

  return (
    <div className="app">

      <h1>AI Slide Summarizer</h1>

      <p className="subtitle">
        Upload your lecture PDF and get an AI-generated summary.
      </p>

      <label className="dropzone">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
        />
        <span className="dropzone-title">
          {selectedFile ? selectedFile.name : "Choose a PDF file"}
        </span>
        <span className="dropzone-hint">
          {selectedFile ? "Click to change file" : "Click to browse"}
        </span>
      </label>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleSummarize}
          disabled={!!loading}
        >
          {loading === "summary"
            ? "Summarizing..."
            : "Summarize"}
        </button>

        <button
          className="btn btn-primary"
          onClick={handleQuiz}
          disabled={!!loading}
        >
          {loading === "quiz"
            ? "Creating quiz..."
            : "Generate Quiz"}
        </button>
      </div>

      {summary && !loading && (
        <button className="btn btn-secondary" onClick={downloadPDF}>
          Download Summary PDF
        </button>
      )}

      {quiz.length > 0 && !loading && (
        <div className="quiz">
          {submitted && (
            <p className="score">
              Your score: {score} / {quiz.length}
            </p>
          )}

          <div className="dots">
            {quiz.map((q, qi) => {
              let className = "dot";

              if (submitted) {
                className += answers[qi] === q.answer ? " correct" : " wrong";
              } else if (answers[qi] !== undefined) {
                className += " answered";
              }

              if (qi === current) {
                className += " active";
              }

              return (
                <button
                  key={qi}
                  className={className}
                  onClick={() => setCurrent(qi)}                />
              );
            })}
          </div>

          <div key={current} className="question-card">
            <p className="question-count">
              Question {current + 1} of {quiz.length}
            </p>

            <p className="question-text">
              {currentQuestion.question}
            </p>

            {currentQuestion.options.map((option, oi) => {
              let className = "option";

              if (submitted && oi === currentQuestion.answer) {
                className += " correct";
              } else if (submitted && answers[current] === oi) {
                className += " wrong";
              } else if (answers[current] === oi) {
                className += " selected";
              }

              return (
                <button
                  key={oi}
                  className={className}
                  onClick={() => selectAnswer(current, oi)}
                  disabled={submitted}
                >
                  {option}
                </button>
              );
            })}

            {submitted && currentQuestion.explanation && (
              <p className="explanation">
                {currentQuestion.explanation}
              </p>
            )}
          </div>

          <div className="actions">
            <button
              className="btn btn-secondary"
              onClick={() => setCurrent(current - 1)}
              disabled={current === 0}
            >
              Previous
            </button>

            {current < quiz.length - 1 ? (
              <button
                className="btn btn-primary"
                onClick={() => setCurrent(current + 1)}
              >
                Next
              </button>
            ) : submitted ? (
              <button className="btn btn-primary" onClick={retryQuiz}>
                Try Again
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={submitQuiz}
                disabled={!allAnswered}
              >
                Submit
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;