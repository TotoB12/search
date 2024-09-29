const fs = require("fs");
const path = require("path");

const rootDir = "./";
const outputFile = "formatted_output.txt";
const foldersToInclude = ["public", "routes"];

const validExtensions = [".js", ".css", ".html"];

function getLanguage(ext) {
  switch (ext) {
    case ".js":
      return "javascript";
    case ".css":
      return "css";
    case ".html":
      return "html";
    default:
      return "";
  }
}

function formatFileContent(filePath, content) {
  const ext = path.extname(filePath);
  const language = getLanguage(ext);
  return `${filePath}\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return formatFileContent(filePath, content);
}

function searchFiles(dir, baseDir = "") {
  let result = "";
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      const folderName = path.basename(filePath);
      if (baseDir === "" || foldersToInclude.includes(baseDir)) {
        result += searchFiles(filePath, baseDir || folderName);
      }
    } else if (validExtensions.includes(path.extname(file))) {
      const relativePath = path.relative(rootDir, filePath);
      result += processFile(relativePath);
    }
  }

  return result;
}

function main() {
  let formattedContent = `I am working on web app that will act like a simply search engine, where users can enter a search term or question, and get an AI generated answer in seconds. Here is the full project:\n\n${searchFiles(rootDir)}`;
  fs.writeFileSync(outputFile, formattedContent);
  console.log(`Formatted content has been saved to ${outputFile}`);
}

main();
