// Helpers the harnesses all wrote for themselves.

const argv = process.argv.slice(2)

// The value of `--name=value` on the command line, or `fallback`.
export const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))
