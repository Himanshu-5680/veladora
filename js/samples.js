/**
 * A fictional payroll service. The AWS strings are the public documentation
 * examples, so the sample can show the rule without shipping a live credential.
 */

const BLOCK = `function formatMoney(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  return sign + "$" + dollars + "." + rem;
}`;

export function sampleFiles() {
  return [
    {
      path: "src/config.js",
      text: `// Fictional sample. AWS documents these two strings as examples.
const REGION = "us-east-1";
const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const password = "changeme";
module.exports = { REGION, AWS_ACCESS_KEY_ID };
`,
    },
    {
      path: "src/pay.js",
      text: `function quoteOvertime(hours, note) {
  // FIXME: holiday rates have been wrong since the 2019 contract
  try {
    return eval(note);
  } catch (err) {
  }
}

function settleWeek(rows) {
  let total = 0;
  for (const row of rows) {
    if (row && row.hours > 40) total += row.hours * row.rate;
  }
  console.log("settled", total);
  return total;
}
`,
    },
    { path: "src/money.js", text: `${BLOCK}\n` },
    { path: "src/money-again.js", text: `// copied during the 2017 rush\n${BLOCK}\n` },
    {
      path: "scripts/migrate.py",
      text: `import pickle
import yaml

def load_shift(path):
    try:
        with open(path, "rb") as handle:
            return pickle.load(handle)
    except Exception:
        pass

def read_rules(text):
    return yaml.load(text)
`,
    },
    {
      path: "legacy/NIGHTPAY.cob",
      text: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. NIGHTPAY.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 PAY PIC 9(5)V99 VALUE 0.
       PROCEDURE DIVISION.
           COMPUTE PAY = 40 * 18.50
           STOP RUN.
`,
    },
    {
      path: "README.md",
      text: `# Night Shift Payroll

Copyright (c) 2014 Night Shift.
A fictional service used to show Veladora. Do not deploy it.
`,
    },
  ];
}
