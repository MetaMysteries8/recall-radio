# Recall Radio

Turn 1–4 study facts into a short sung clip, review the lyrics before spending on music, and practice fill-in-the-blank recall.

Built by Codex, an AI agent, on behalf of [MetaMysteries8](https://github.com/MetaMysteries8) for Pollinations quest [#15727](https://github.com/pollinations/pollinations/issues/15727). Original implementation; MIT licensed.

## Try it

Use the live app's **Try a real sample** button without signing in or paying. The bundled MP3 is actual Pollinations music, not browser speech synthesis. `generation-evidence.json` records the requests, response, manual lyric/quiz review, audio metadata, transcription, and measured cost.

To make your own song:

1. Paste one short fact per line, choose a style, and connect your own [Pollinations key](https://enter.pollinations.ai/keys). A local text key file can be read into memory; it is not uploaded to the host.
2. **Write my lyrics** makes one text request using `openai/gpt-5.4-nano`. Review/edit the result. Every source sentence must still appear in the lyrics, with whitespace/case normalized. This check preserves the supplied facts; it does not establish that the notes or every added lyric are true.
3. **Sing this** makes a separate request to `POST https://gen.pollinations.ai/v1/audio/speech`, using `google/lyria-3-clip-preview`. The live model-list price is shown (currently about 0.04 Pollen per 30-second clip). This model requires paid Pollen.
4. Listen for missing/changed words; singing is generative and exact reproduction is not guaranteed. Quiz answers come from the source facts. Save the MP3 and notes in this browser's IndexedDB collection, or download the MP3.

The key is held only in page memory and the password field, sent only in the Authorization header to `gen.pollinations.ai`, and cleared on reload/navigation or **Clear key**. It is never included in saved songs, URLs, or analytics. Notes/lyrics are sent to Pollinations only when you choose the corresponding generation step. No shared credentials, hosted backend, public agent, or secret creation is required.

Requests are not automatically retried. Cancellation stops the local request; the provider may still finish and bill it. Storage holds up to 20 songs; clearing browser data removes the collection. The app uses no analytics. Fonts load from Google Fonts.

## Run locally

Requires Node.js for tests and Python for the simple development server:

```sh
npm test
npm run dev
```

Open http://127.0.0.1:8767/. No build or dependencies are required. Static assets are `index.html`, `app.js`, `core.js`, `library.js`, `style.css`, `icon.svg`, `demo.json`, and `demo.mp3`.

Tests directly import production code and cover altered factual numbers, invalid quiz answers, literal formula blanks, answer marking, note limits, and incomplete provider receipts. Browser testing covers live generation, fact-edit blocking, quiz results, MP3 playback, and collection persistence.

API reference: [Pollinations docs](https://gen.pollinations.ai/docs), [audio models/prices](https://gen.pollinations.ai/audio/models), [text models](https://gen.pollinations.ai/text/models).
