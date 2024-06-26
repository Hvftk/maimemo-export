import * as csv from "csv-stringify/sync"
import { MaimemoDB } from "maimemo"
import { NotePad } from "notepad"
import { translateByDict } from "translater"
import ProgressBar from "progressbar"
import { ExportOpt } from "typings"
import path from "node:path"
const bar = new ProgressBar(30)

async function checkFilesExist(files: string[]) {
  const checks = files.map(file => Bun.file(file).exists())
  const results = await Promise.all(checks)
  return results.every(result => result)
}

export const export2file = async (
  data: { word: string; translation: string; list?: string }[],
  option: {
    file: string
    type: "txt" | "list" | "csv"
  }
) => {
  const { type, file } = option
  const res = (() => {
    switch (type) {
      case "txt":
        return data.map(k => k.word).join("\n")
      case "csv":
        return csv.stringify(
          data.map(k => ({ word: k.word, translation: k.translation }))
        )
      case "list":
        let list = data[0].list!
        return data
          .reduce(
            (acc, cur) => {
              if (cur.list !== list) {
                list = cur.list!
                acc.push("#" + list)
              }
              acc.push(cur.word)
              return acc
            },
            ["#" + list]
          )
          .join("\n")
    }
  })()
  await Bun.write(file, res)
}

export const exportLibrary = async (
  books: string[],
  db: MaimemoDB | NotePad,
  option?: ExportOpt
) => {
  for (let i = 0; i < books.length; i++) {
    const book = books[i]
    const defaultOpt: Required<ExportOpt> = {
      dir: "libraries",
      types: ["txt", "list", "csv"],
      override: false,
      memorized: false,
      word: false,
      bookOpt: {
        order: "book"
      }
    }

    const { types, dir, override, memorized, bookOpt, word } = option
      ? Object.assign(defaultOpt, option)
      : defaultOpt

    const files = types.map(type =>
      path.resolve(
        dir,
        type,
        `${book.replace(/\\|\//g, "|")}.${type === "list" ? "txt" : type}`
      )
    )
    if ((await checkFilesExist(files)) && !override) {
      bar.render(`${"● ".repeat(files.length)} ${book}`, {
        completed: i + 1,
        total: books.length
      })
    } else {
      const res = []
      const data = (() => {
        try {
          return db.getAllWordsInfo(book, bookOpt).reduce((acc, cur) => {
            const { word: vc_vocabulary, list } = cur
            if (memorized) {
              const opt = Array.isArray(memorized)
                ? {
                    data: memorized,
                    type: "memorized" as "memorized" | "unmemorized"
                  }
                : memorized
              const { type, data } = opt
              if (
                (type === "memorized" && !data.includes(vc_vocabulary)) ||
                (type === "unmemorized" && data.includes(vc_vocabulary))
              )
                return acc
            }
            if (word) {
              if (
                ((word === "word" || word === true) &&
                  /\W/.test(vc_vocabulary)) ||
                (word === "phrase" && !/\W/.test(vc_vocabulary))
              )
                return acc
            }
            const translation = translateByDict(vc_vocabulary)
            acc.push({ word: vc_vocabulary, translation, list })
            return acc
          }, [] as { word: string; translation: string; list: string | undefined }[])
        } catch (err) {
          console.log(err)
          return []
        }
      })()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const type = types[i]
        if ((await Bun.file(file).exists()) && !override) {
          res.push("●")
          continue
        }
        if (!data.length || (type === "list" && !data[0].list)) {
          res.push("x")
          continue
        }
        try {
          await export2file(data, {
            file,
            type
          })
          res.push("√")
        } catch (err) {
          console.log(err)
          res.push("x")
        }
      }
      bar.render(`${res.join(" ")} ${book}`, {
        completed: i + 1,
        total: books.length
      })
    }
  }
}
