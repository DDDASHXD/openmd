export const getArgumentValue = (argv, name) => {
  const inline = argv.find((argument) => argument.startsWith(`${name}=`))

  if (inline) {
    return inline.slice(name.length + 1)
  }

  const index = argv.indexOf(name)
  const value = index === -1 ? undefined : argv[index + 1]

  if (!value || value.startsWith('--')) {
    return undefined
  }

  return value
}

export const hasFlag = (argv, name) => argv.includes(name)

export const parseServerArgs = (argv = process.argv) => {
  const requestedWorkspace = getArgumentValue(argv, '--workspace')
  const requestedPort = getArgumentValue(argv, '--port')
  const requestedHostname = getArgumentValue(argv, '--hostname')
  const requestedAppDir = getArgumentValue(argv, '--app-dir')
  const headless = hasFlag(argv, '--headless')

  return {
    workspaceRoot: requestedWorkspace ? undefined : undefined,
    workspaceArg: requestedWorkspace,
    port: requestedPort ? Number.parseInt(requestedPort, 10) : undefined,
    hostname: requestedHostname,
    appDirectory: requestedAppDir,
    headless,
  }
}
