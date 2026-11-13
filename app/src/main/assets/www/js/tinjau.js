// ── Tinjau soal sebelumnya (Mode Tentamen) — helper & delegasi klik ──

// ── Tinjau soal sebelumnya (Mode Tentamen) ────────────────────────────────
// Mode dengan timer: daftar baru muncul setelah soal yang sedang berjalan sudah dijawab.
// Mode Bekicot (tanpa timer): bisa dibuka kapan saja, tanpa batas.
function tentamenSolvedBefore() {
  const out = [];
  for (let i = 0; i < currentIdx; i++) {
    const a = tentamenAnswers[i];
    if (typeof a === "string" && a !== "skipped") out.push(i);
  }
  return out;
}
function tentamenIsCorrect(i) {
  const q = tentamenQuestions[i];
  const a = tentamenAnswers[i];
  if (!q || typeof a !== "string" || a === "skipped") return false;
  return q.isIsian ? true : a === q.answer;
}
function tentamenReviewAllowed() {
  if (tentamenState !== "running") return false;
  return tentamenDifficulty === "bekicot" || qPhase === "answered_manual";
}
// Indeks soal yang sedang ditinjau, atau null kalau kembali ke soal berjalan.
function tentamenReviewViewerIdx() {
  if (tentamenReviewIdx === null || tentamenReviewIdx === undefined) return null;
  const ok = tentamenReviewIdx >= 0 && tentamenReviewIdx < currentIdx && typeof tentamenAnswers[tentamenReviewIdx] === "string";
  return ok ? tentamenReviewIdx : null;
}
function tentamenReviewBarHtml() {
  if (!tentamenReviewAllowed()) return "";
  const solved = tentamenSolvedBefore();
  if (!solved.length) return "";
  let html = `<div class="trvBar"><button class="trvToggle iconBtn${tentamenReviewListOpen ? " open" : ""}" id="tentamenReviewToggle" title="Soal sebelumnya" aria-label="Soal sebelumnya" aria-expanded="${tentamenReviewListOpen}">${svgIcon("list")} <span class="lbl">Soal sebelumnya</span> <span class="mono">(${solved.length})</span></button></div>`;
  if (tentamenReviewListOpen) {
    html += `<div class="trvList">`;
    for (const i of solved) {
      const q = tentamenQuestions[i];
      const ok = tentamenIsCorrect(i);
      const snippet = String(q.question || "").replace(/\s+/g, " ").slice(0, 80);
      html += `<button class="trvItem ${ok ? "ok" : "bad"}" data-review-idx="${i}"><span class="trvNum mono">${i + 1}</span><span class="trvText">${escapeHtml(snippet)}</span><span class="trvChip">${ok ? svgIcon("check") + " Benar" : svgIcon("close") + " Salah"}</span></button>`;
    }
    html += `</div>`;
  }
  return html;
}
function tentamenReviewViewerHtml(i) {
  const q = tentamenQuestions[i];
  const a = tentamenAnswers[i];
  const ok = tentamenIsCorrect(i);
  let html = `<div class="trvBanner ${ok ? "ok" : "bad"}">Meninjau soal ${i + 1} \u00B7 ${ok ? "dijawab benar" : "dijawab salah"}</div>`;
  html += q.isIsian ? renderIsianCard(q, i + 1, a) : renderQuestionCard(q, i + 1, a, true);
  return html;
}

// Delegasi klik untuk kontrol tinjauan (tombol daftar, buka soal, lanjutkan kuis).
document.addEventListener("click", (e) => {
  const t = e.target.closest ? e.target.closest("#tentamenReviewToggle, #tentamenResumeBtn, [data-review-idx]") : null;
  if (!t || quizMode !== "tentamen" || tentamenState !== "running") return;
  if (t.id === "tentamenReviewToggle") {
    tentamenReviewListOpen = !tentamenReviewListOpen;
  } else if (t.id === "tentamenResumeBtn") {
    tentamenReviewIdx = null;
  } else {
    tentamenReviewIdx = Number(t.dataset.reviewIdx);
    tentamenReviewListOpen = false;
  }
  render();
});
