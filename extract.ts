/**
Copyright 2022 Ryusei Yamaguchi

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js"
import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api"

async function* pagesInRange(pageNumBegin: number, pageNumEnd: number, pdf: PDFDocumentProxy) {
  for (let pageNum = pageNumBegin; pageNum <= pageNumEnd; pageNum++) {
    const page = await pdf.getPage(pageNum)
    yield page
  }
}

interface TextSpan {
  page: number
  x: number
  y: number
  h: number
  str: string
  column: number
}

function getColumn(x: number) {
  if (x < 100) return 0
  if (100 <= x && x < 150) return 1
  if (150 <= x && x < 210) return 2
  if (210 <= x && x < 270) return 3
  if (270 <= x && x < 320) return 4
  if (320 <= x && x < 390) return 5
  if (390 <= x && x < 450) return 6
  if (450 <= x && x < 510) return 7
  return 8
}

async function extractNyukanSeijiTextData(pdf: PDFDocumentProxy, range: [number, number]) {
  const lines: TextSpan[][] = []
  let currentLine!: TextSpan[]
  const nextEntry = () => {
    if (currentLine?.length) {
      lines.push(currentLine)
    }
    currentLine = []
  }

  nextEntry()
  for await (const page of pagesInRange(...range, pdf)) {
    const textContent = await page.getTextContent()
    const textContentItems = textContent.items as TextItem[]
    let prevColumn = 0
    for (const text of textContentItems) {
      if (!/^[0-9a-f]{4,5}$/.test(text.str)) {
        continue
      }
      const item = {
        page: page.pageNumber,
        x: text.transform[4],
        y: text.transform[5],
        h: text.height,
        str: text.str.trim(),
        column: getColumn(text.transform[4])
      }
      if (item.column % 3 === 0 && prevColumn % 3 !== 0) {
        nextEntry()
      }
      if (item.str == "efa3") {
        console.log(item, prevColumn)
      }
      prevColumn = item.column
      currentLine.push(item)
    }
    nextEntry()
  }
  nextEntry()
  return lines
}

function formatNyukanSeijiData(lines: TextSpan[][]) {
  return lines.map(spans => spans.map(span => span.str))
}

async function main() {
  const file = await fs.readFile(path.join(__dirname, "930002422.pdf"))
  const pdf = await pdfjs.getDocument(file).promise
  const table4_1 = formatNyukanSeijiData(await extractNyukanSeijiTextData(pdf, [37, 108]))
  const table4_2 = formatNyukanSeijiData(await extractNyukanSeijiTextData(pdf, [109, 190]))
  await fs.writeFile(path.join(__dirname, "nyukanseiji.json"), JSON.stringify({ table4_1, table4_2 }, null, 2), "utf-8")
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
