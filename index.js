require("dotenv").config();
const cp = require("child_process");
const simpleGit = require("simple-git");
const fs = require("fs");

const DIR = process.env.REPOSITORY_DIR;
if (!DIR)
  throw new Error("Please set the 'REPOSITORY_DIR' environment variable. ");
const KEEP = ["dev", "master", "stage", "local"];

const run = (cmd, opts = {}) =>
  cp
    .execSync(cmd, { cwd: DIR, ...opts })
    .toString()
    .trim();

(async () => {
  const branchListResult = run("git branch -r");
  let branchList = branchListResult
    .split("\n")
    .filter(
      (n) =>
        typeof n === "string" &&
        n &&
        n.trim() &&
        n.indexOf("->") === -1 &&
        KEEP.indexOf(n) === -1
    )
    .map((name) => ({
      name: name.trim(),
    }))
    .map((b) => ({
      ...b,
      commit: run(`git rev-parse "${b.name}"`),
    }))
    .map((b) => ({
      ...b,
      timestamp: run(`git show -s --format=%ci ${b.commit}`),
    }))
    .map((b) => ({
      ...b,
      owner: run(`git show -s --format=%an ${b.commit}`),
    }))
    .map((b) => ({
      ...b,
      isInDev: run(`git branch --contains "${b.name}"`).indexOf("* dev") > -1,
    }));

  branchList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  fs.writeFileSync("./data.json", JSON.stringify(branchList, null, 2));

  let ownerBranches = branchList.reduce(
    (prev, curr) => {
      let target = curr.isInDev ? prev.merged : prev.unmerged;
      if (!Array.isArray(target[curr.owner])) target[curr.owner] = [];
      target[curr.owner].push(curr);
      return prev;
    },
    { merged: {}, unmerged: {} }
  );

  for (const owner of Object.keys(ownerBranches.unmerged)) {
    fs.writeFileSync(
      `./data/unmerged/${owner}.json`,
      JSON.stringify(ownerBranches.unmerged[owner], null, 2)
    );
  }
  for (const owner of Object.keys(ownerBranches.merged)) {
    fs.writeFileSync(
      `./data/merged/${owner}.json`,
      JSON.stringify(ownerBranches.merged[owner], null, 2)
    );
  }
})();
