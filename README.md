# Veladora

A local altar for code you inherited.

**Live:** [vectornomadhp88.github.io/veladora](https://vectornomadhp88.github.io/veladora/) · **Code:** [github.com/vectornomadhp88/veladora](https://github.com/vectornomadhp88/veladora)

Drop a folder. Veladora lights a candle for each thing the next maintainer will trip over: a key in a source file, an `eval`, an empty `catch`, a FIXME from a contract nobody was in the room for, the same six lines copied into a second file. The score is a vigil, not a certificate. If you want the findings said back as a remembrance, Gemma 3 270M runs in the tab. The files never leave.

This is a static site. GitHub Pages, Vercel, and Render can host it with no build.

## Start

```bash
npm test
npx serve .
```

Open the URL it prints. The sample payroll service is already on the altar, including the public AWS documentation example credentials, so you can see a candle without dropping your own tree.

`file://` will not work. The page is ES modules.

## What it is for

You cloned something the last author cannot explain. The comments are the only minutes of a meeting. Veladora is the hour before you "clean it up" and delete the one sentence that said why the rate is wrong.

It is also a Día de los Muertos project in the plain sense: an ofrenda is a place you set for someone who is not in the room. The card on the Altar tab is for a maintainer, a language, or a decision. The biographies of COBOL, Fortran, ALGOL, and the rest are written down, so a small model is not asked to invent a birth year.

## What stays here

| | Veladora | A closed model API |
| --- | --- | --- |
| Where the files go | The tab you dropped them in | A server you do not operate |
| Where inference runs | This browser, after one download | Their GPU, on every request |
| Cost of a second opinion | Nothing, once the weights are cached | A token bill, and the tree in the prompt |
| If the vendor shuts the model off | The rules still run. The weights are on disk in the browser cache | The feature disappears |

The rule engine does not need the model. The model, when you light it, receives a redacted brief of at most eight findings. It does not receive the files. A reply that loops is thrown away and the archivist draft stays.

## Checks

| Candle | What it looks for |
| --- | --- |
| Unmarked key | AWS access key ids, private key blocks, GitHub / Slack / Stripe shapes, and a secret assigned to a string |
| Open door | `eval`, `new Function`, HTML sinks, `pickle.load`, `yaml.load`, `shell=True`, `os.system` |
| Unfinished vow | `TODO`, `FIXME`, `HACK`, `XXX` |
| Empty cup | An empty `catch`, or `except: pass` |
| Echo | The same six code lines in two places |
| Long night | A function of 80 lines, or 14 decision points |
| Whisper left on | `console.log`, `debugger` |
| Faded year | A copyright year three or more years behind |
| Unmarked grave | Three or more files and no `LICENSE` |

`password = "changeme"` stays dark. So does anything under `node_modules`. Exports redact secrets as `AKIA…MPLE`. "Show secrets here" reveals them in the tab and nowhere else.

## Models

- **Gemma 3 270M Instruct**, ONNX build [`onnx-community/gemma-3-270m-it-ONNX`](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX). WebGPU, `q4f16`, about 300 MB the first time. Weights are under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms). This repository does not redistribute them.
- **SmolLM2 135M Instruct**, [`HuggingFaceTB/SmolLM2-135M-Instruct`](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct), Apache-2.0. This is the understudy for a browser with no WebGPU adapter. It is not Gemma, and the page says so.

Both run through [Transformers.js 4.2.0](https://huggingface.co/docs/transformers.js) in a module worker, imported from jsDelivr so nothing has to be bundled. Temperature is 0.6. Details and the diagram are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Do not add `Cross-Origin-Embedder-Policy: require-corp` on the host. It will block the weight download.

## Host it

There is no build command. Publish the repository root.

- **GitHub Pages:** the `pages` workflow deploys `main`. In the repository settings, set Pages to GitHub Actions.
- **Vercel:** import the repository. Framework preset: Other. Output: the root. `vercel.json` is already here.
- **Render:** new Static Site, or use `render.yaml`. Build command can be a no-op. Publish directory: `.`

## Tests

```bash
npm test
```

Node 20 or newer. The tests cover the rule engine, redaction, the sample vigil, the garbage filter, and the git log parser. They do not download a model.

## License

MIT for this repository. Model weights keep their own licenses. See [LICENSE](LICENSE).

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md). A new check needs a fixture that lights and a lookalike that stays dark.
