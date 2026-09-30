import {
  AUDIO_MODEL,
  audioRequest,
  checkedTextResponse,
  correctAnswer,
  lyricRequest,
  quizLine,
  readFacts,
  TEXT_MODEL,
  validateLyrics,
} from "./core.js";
import { deleteSong, listSongs, putSong } from "./library.js";

const $ = (id) => document.getElementById(id);
let apiKey = "",
  current = null,
  audioBlob = null,
  audioUrl = null,
  controller = null,
  library = [];
let audioPrice = null;
const samples = {
  water:
    "Water freezes at 0 degrees Celsius.\nWater boils at 100 degrees Celsius.",
  planets:
    "Mercury is the closest planet to the Sun.\nVenus is the hottest planet.\nEarth is the third planet from the Sun.",
  words:
    "Bonjour means hello in French.\nMerci means thank you in French.\nAu revoir means goodbye in French.",
};
function status(message) {
  $("status").textContent = message;
}
function keyChanged() {
  apiKey = $("key").value.trim();
  $("key-summary").textContent = apiKey
    ? "Your key is connected · memory only"
    : "Connect your Pollinations key";
}
$("key").addEventListener("input", keyChanged);
$("key-file").addEventListener("change", async () => {
  const file = $("key-file").files[0];
  if (!file) return;
  if (file.size > 4096) {
    status("That file is too large for an API key.");
    $("key-file").value = "";
    return;
  }
  try {
    $("key").value = (await file.text()).trim();
    keyChanged();
    status("Key loaded in memory. It is not saved with songs.");
  } catch {
    status("Could not read that file.");
  }
  $("key-file").value = "";
});
$("clear-key").addEventListener("click", () => {
  $("key").value = "";
  $("key-file").value = "";
  keyChanged();
  status("Key cleared from this page.");
});
document.querySelectorAll("[data-sample]").forEach((button) => {
  button.addEventListener("click", () => {
    $("notes").value = samples[button.dataset.sample];
  });
});
function lock(busy) {
  document
    .querySelectorAll("button,input,select,textarea")
    .forEach((element) => {
      if (element.id !== "cancel") element.disabled = busy;
    });
  $("cancel").hidden = !busy;
  if (!busy) factCheck();
}
async function paid(path, request) {
  if (!apiKey)
    throw Error("Connect your own Pollinations key, or try the free sample.");
  const response = await fetch(`https://gen.pollinations.ai${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
    signal: controller.signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Error(
      response.status === 401 || response.status === 403
        ? "The key cannot access this model. Check your key permissions and paid Pollen balance."
        : response.status === 429
          ? "Rate limit reached. Nothing will be retried automatically."
          : `Pollinations returned HTTP ${response.status}. Nothing will be retried automatically.`,
    );
  }
  return response;
}
async function run(work) {
  if (controller) return;
  controller = new AbortController();
  lock(true);
  try {
    await work();
  } catch (error) {
    status(
      error.name === "AbortError"
        ? "Request cancelled locally. The provider may still finish and charge it; do not immediately repeat the request."
        : error.message,
    );
  } finally {
    controller = null;
    lock(false);
  }
}
$("cancel").addEventListener("click", () => controller?.abort());
function clearAudio() {
  $("audio").pause();
  $("audio").removeAttribute("src");
  $("audio").load();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  audioBlob = null;
  $("audio").hidden = true;
  $("track-actions").hidden = true;
}
function attachAudio(blob) {
  clearAudio();
  audioBlob = blob;
  audioUrl = URL.createObjectURL(blob);
  $("audio").src = audioUrl;
  $("audio").hidden = false;
  $("track-actions").hidden = false;
}
function showSong(song, blob) {
  clearAudio();
  current = song;
  $("empty").hidden = true;
  $("song").hidden = false;
  $("song-title").textContent = song.title;
  $("lyrics").value = song.lyrics;
  $("receipt").textContent = song.textReceipt
    ? `Lyrics: ${TEXT_MODEL} · ${song.textReceipt.id} · ${song.textReceipt.tokens} tokens${song.demo ? " · Real generated sample" : ""}`
    : "";
  if (blob) attachAudio(blob);
  $("lyrics").readOnly = !!blob;
  $("sing").hidden = !!blob;
  $("save").textContent = library.some((x) => x.id === song.id)
    ? "Saved ✓"
    : "Save to collection";
  factCheck();
  switchTab("listen");
  renderQuiz();
}
function factCheck() {
  if (!current) return;
  try {
    validateLyrics($("lyrics").value, current.facts);
    $("fact-check").textContent =
      `✓ All ${current.facts.length} source facts are intact. Review the rest of the wording before singing.`;
    $("fact-check").classList.remove("error");
    $("sing").disabled = false;
  } catch (error) {
    $("fact-check").textContent = error.message;
    $("fact-check").classList.add("error");
    $("sing").disabled = true;
  }
}
$("lyrics").addEventListener("input", factCheck);
$("draft").addEventListener("click", () =>
  run(async () => {
    const notes = $("notes").value,
      style = $("style").value;
    const request = lyricRequest(notes, style);
    status("Writing a short hook around your facts… One paid text request.");
    const response = await paid("/v1/chat/completions", request),
      body = await response.json();
    const draft = checkedTextResponse(body, readFacts(notes));
    showSong(
      {
        ...draft,
        id: crypto.randomUUID(),
        style,
        createdAt: new Date().toISOString(),
        textReceipt: { id: body.id, tokens: body.usage.total_tokens },
      },
      null,
    );
    status(
      "Draft ready. Review or edit it, then choose whether to pay for singing.",
    );
  }),
);
$("sing").addEventListener("click", () =>
  run(async () => {
    if (!current) return;
    const lyrics = validateLyrics($("lyrics").value, current.facts);
    const request = audioRequest(lyrics, current.facts, current.style);
    status(
      "Recording your 30-second song… One paid music request. This may take a few minutes.",
    );
    const response = await paid("/v1/audio/speech", request);
    if (
      !response.headers.get("content-type")?.toLowerCase().startsWith("audio/")
    )
      throw Error(
        "The music response was not audio. It will not be retried automatically.",
      );
    const blob = await response.blob();
    if (blob.size < 1000)
      throw Error("The music response was empty or incomplete.");
    current = {
      ...current,
      lyrics,
      audioReceipt: { model: AUDIO_MODEL, bytes: blob.size },
    };
    attachAudio(blob);
    $("lyrics").readOnly = true;
    $("sing").hidden = true;
    $("receipt").textContent +=
      ` · Singing: ${AUDIO_MODEL} · ${(blob.size / 1024).toFixed(0)} KB`;
    status(
      "Ready to listen. Check that the singing matches your facts, then save or practice.",
    );
  }),
);
function switchTab(tab) {
  const quiz = tab === "quiz";
  if (quiz) $("audio").pause();
  $("listen-view").hidden = quiz;
  $("quiz-view").hidden = !quiz;
  for (const [id, active] of [
    ["listen-tab", !quiz],
    ["quiz-tab", quiz],
  ]) {
    $(id).classList.toggle("active", active);
    $(id).setAttribute("aria-pressed", String(active));
  }
}
$("listen-tab").addEventListener("click", () => switchTab("listen"));
$("quiz-tab").addEventListener("click", () => switchTab("quiz"));
function renderQuiz() {
  const form = $("quiz-form");
  form.replaceChildren();
  if (!current) return;
  current.quiz.forEach((q, i) => {
    const label = document.createElement("label");
    label.htmlFor = `answer-${i}`;
    label.textContent = `${i + 1}. ${quizLine(current.facts[q.factIndex], q.answer)}`;
    const input = document.createElement("input");
    input.id = `answer-${i}`;
    input.name = `answer-${i}`;
    input.autocomplete = "off";
    input.required = true;
    input.placeholder = "Missing word or phrase";
    const feedback = document.createElement("p");
    feedback.id = `feedback-${i}`;
    feedback.className = "quiz-feedback";
    form.append(label, input, feedback);
  });
  const submit = document.createElement("button");
  submit.className = "primary";
  submit.type = "submit";
  submit.textContent = "Check my answers";
  form.append(submit);
  const result = document.createElement("p");
  result.id = "quiz-result";
  result.setAttribute("role", "status");
  result.className = "quiz-feedback";
  form.append(result);
}
$("quiz-form").addEventListener("submit", (event) => {
  event.preventDefault();
  let correct = 0;
  current.quiz.forEach((q, i) => {
    const match = correctAnswer($(`answer-${i}`).value, q.answer);
    correct += Number(match);
    $(`feedback-${i}`).textContent = match
      ? "✓ Correct."
      : `The missing answer is “${q.answer}”. Source: ${current.facts[q.factIndex]}`;
  });
  $("quiz-result").textContent =
    `${correct} of ${current.quiz.length} correct. Listen again, then try without the lyrics.`;
});
$("reset-quiz").addEventListener("click", renderQuiz);
async function refreshLibrary() {
  try {
    library = (await listSongs()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    renderLibrary();
  } catch {
    status(
      "Browser storage is unavailable. You can still listen, practice, and download your song.",
    );
  }
}
function renderLibrary() {
  $("count").textContent = library.length;
  const tracks = $("tracks");
  tracks.replaceChildren();
  if (!library.length) {
    const p = document.createElement("p");
    p.className = "library-empty";
    p.textContent = "Nothing on the shelf yet. Save a song to come back to it.";
    tracks.append(p);
    return;
  }
  for (const song of library) {
    const row = document.createElement("div");
    row.className = "track";
    const icon = document.createElement("span");
    icon.className = "track-icon";
    icon.textContent = "◉";
    const info = document.createElement("div");
    info.className = "track-info";
    const title = document.createElement("strong");
    title.textContent = song.title;
    const small = document.createElement("small");
    small.textContent = `${song.style.toUpperCase()} · ${song.facts.length} FACTS · ${new Date(song.createdAt).toLocaleDateString()}`;
    info.append(title, small);
    const open = document.createElement("button");
    open.textContent = "Open";
    open.setAttribute("aria-label", `Open ${song.title}`);
    open.addEventListener("click", () => {
      showSong(song, song.audio);
      $("song").scrollIntoView({ behavior: "smooth", block: "center" });
      status("Opened from this browser’s collection. No API request.");
    });
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete ${song.title}`);
    remove.addEventListener("click", async () => {
      try {
        await deleteSong(song.id);
        await refreshLibrary();
        status("Song removed from this browser’s collection.");
      } catch {
        status("Could not remove the saved song.");
      }
    });
    row.append(icon, info, open, remove);
    tracks.append(row);
  }
}
$("save").addEventListener("click", async () => {
  if (!current || !audioBlob) return;
  if (library.length >= 20 && !library.some((song) => song.id === current.id)) {
    status("Your collection holds 20 songs. Delete one before saving another.");
    return;
  }
  try {
    await putSong({ ...current, audio: audioBlob });
    await refreshLibrary();
    $("save").textContent = "Saved ✓";
    status("Saved on this browser, including the MP3. Your key was not saved.");
  } catch {
    status(
      "Could not save: browser storage may be full or blocked. Download the MP3 instead.",
    );
  }
});
$("download").addEventListener("click", () => {
  if (!audioUrl || !current) return;
  const a = document.createElement("a");
  a.href = audioUrl;
  a.download = `${current.title.replace(/[^a-z0-9]+/gi, "-")}.mp3`;
  a.click();
});
$("demo").addEventListener("click", () =>
  run(async () => {
    status("Loading the real sample. No paid request.");
    const [json, audio] = await Promise.all([
      fetch("demo.json", { signal: controller.signal }),
      fetch("demo.mp3", { signal: controller.signal }),
    ]);
    if (!json.ok || !audio.ok) throw Error("The sample could not load.");
    const data = await json.json();
    showSong(data, await audio.blob());
    status(
      "Real Pollinations sample loaded. Listen or test your recall for free.",
    );
  }),
);
async function pricing() {
  try {
    const response = await fetch("https://gen.pollinations.ai/audio/models");
    if (!response.ok) return;
    const models = await response.json(),
      model = models.find((m) => m.name === AUDIO_MODEL);
    const price = Number(model?.pricing?.completionAudioTokens);
    if (Number.isFinite(price) && price > 0) {
      audioPrice = price;
      $("price").textContent =
        `Lyrics: one small text charge. Singing: about ${price} Pollen for a 30-second clip at the current listed rate. You pay with your own key; no automatic retries.`;
      $("sing").firstChild.textContent =
        `Sing this · about ${audioPrice} Pollen `;
    }
  } catch {
    /* Pricing is optional; generation errors remain visible. */
  }
}
refreshLibrary();
pricing();
window.addEventListener("pagehide", () => {
  apiKey = "";
  $("key").value = "";
  controller?.abort();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
});
