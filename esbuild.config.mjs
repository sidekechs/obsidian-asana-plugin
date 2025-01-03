import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import builtins from "builtin-modules";

const banner =
`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === 'production';
const distPath = process.argv[3] || 'dist';

// Create dist directory if it doesn't exist
if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
}

// Copy manifest and styles
fs.copyFileSync("manifest.json", path.join(distPath, "manifest.json"));
if (fs.existsSync("styles.css")) {
    fs.copyFileSync("styles.css", path.join(distPath, "styles.css"));
}

const buildOptions = {
    banner: {
        js: banner,
    },
    entryPoints: ["src/main.tsx"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins],
    format: "cjs",
    target: "es2018",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: path.join(distPath, "main.js"),
    loader: {
        ".tsx": "tsx",
        ".ts": "tsx",
    },
    allowOverwrite: true
};

if (prod) {
    await esbuild.build(buildOptions);
    process.exit(0);
} else {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
}
