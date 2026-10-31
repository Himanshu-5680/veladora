# Security

Veladora is a local first pass. It will miss real secrets, and it will sometimes light a candle on a string that only looks like one. Do not treat a high score as a clearance to ship.

## Reporting a vulnerability in Veladora itself

Please use **Private vulnerability reporting** on this repository (Security → Advisories → Report a vulnerability). Do not open a public issue with a proof of concept that includes a working exploit against the page.

The sensitive case is cross-site scripting from a file someone dropped on the altar. Findings are written with `textContent`. If you can get markup from a scanned file to execute, that is the report we want.

## What not to send

Do not include live credentials in an issue, a pull request, or a model transcript. The sample repository uses the AWS documentation example access key id and secret, which are public placeholders, not live credentials.

Exports and the text sent to the in-browser model are redacted (first four characters, last four). The unredacted value exists only in the tab, behind "Show secrets here".
