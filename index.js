const core = require("@actions/core")
const github = require("@actions/github")

const validEvent = ["pull_request"]

function validateTitle(title, phrase, caseSensitive, prefixOrSuffix = "prefix") {
  if (!caseSensitive) {
    phrase = phrase.toLowerCase()
    title = title.toLowerCase()
  }

  return prefixOrSuffix === "prefix" ? title.startsWith(phrase) : prefixOrSuffix === "suffix" ? new RegExp(`(^.*)(${phrase})`).test(title) : false
}

async function run() {
  const TYPE_PREFIX = "prefix"
  const TYPE_SUFFIX = "suffix"

  try {
    const authToken = core.getInput("github_token", { required: true })
    const eventName = github.context.eventName
    core.info(`Event name: ${eventName}`)
    if (validEvent.indexOf(eventName) < 0) {
      core.setFailed(`Invalid event: ${eventName}`)
      return
    }

    const owner = github.context.payload.pull_request.base.user.login
    const repo = github.context.payload.pull_request.base.repo.name

    const client = new github.getOctokit(authToken)
    // The pull request info on the context isn't up to date. When
    // the user updates the title and re-runs the workflow, it would
    // be outdated. Therefore fetch the pull request via the REST API
    // to ensure we use the current title.
    const { data: pullRequest } = await client.rest.pulls.get({
      owner,
      repo,
      pull_number: github.context.payload.pull_request.number,
    })

    const title = pullRequest.title

    core.info(`Pull Request title: "${title}"`)

    // Check min length
    const minLen = parseInt(core.getInput("min_length"))
    if (title.length < minLen) {
      core.setFailed(
        `Pull Request title "${title}" is smaller than min length specified - ${minLen}`
      )
      return
    }

    // Check max length
    const maxLen = parseInt(core.getInput("max_length"))
    if (maxLen > 0 && title.length > maxLen) {
      core.setFailed(
        `Pull Request title "${title}" is greater than max length specified - ${maxLen}`
      )
      return
    }

    // Check if title starts with an allowed prefix
    let prefixes = core.getInput("allowed_prefixes")
    const prefixCaseSensitive =
      core.getInput("prefix_case_sensitive") === "true"
    core.info(`Allowed Prefixes: ${prefixes}`)
    if (
      prefixes.length > 0 &&
      !prefixes
        .split(",")
        .some((el) => validateTitle(title, el, prefixCaseSensitive, TYPE_PREFIX))
    ) {
      core.setFailed(
        `Pull Request title "${title}" did not match any of the prefixes - ${prefixes}`
      )
      return
    }

    // Check if title starts with a disallowed prefix
    prefixes = core.getInput("disallowed_prefixes")
    core.info(`Disallowed Prefixes: ${prefixes}`)
    if (
      prefixes.length > 0 &&
      prefixes
        .split(",")
        .some((el) => validateTitle(title, el, prefixCaseSensitive, TYPE_PREFIX))
    ) {
      core.setFailed(
        `Pull Request title "${title}" matched with a disallowed prefix - ${prefixes}`
      )
      return
    }

    // Check if title ends with an allowed suffix
    let suffixes = new RegExp(core.getInput("allowed_suffixes"))
    const suffixCaseSensitive =
      core.getInput("suffix_case_sensitive") === "true"
    core.info(`Allowed Suffixes: ${suffixes}`)
    if (
      suffixes.length > 0 &&
      !suffixes
        .split(",")
        .some((el) => validateTitle(title, el, suffixCaseSensitive, TYPE_SUFFIX))
    ) {
      core.setFailed(
        `Pull Request title "${title}" did not match any of the suffixes - ${suffixes}`
      )
      return
    }

    // Check if title ends with a disallowed suffix
    suffixes = core.getInput("disallowed_suffixes")
    core.info(`Disallowed Suffixes: ${suffixes}`)
    if (
      suffixes.length > 0 &&
      suffixes
        .split(",")
        .some((el) => validateTitle(title, el, suffixCaseSensitive, TYPE_SUFFIX))
    ) {
      core.setFailed(
        `Pull Request title "${title}" matched with a disallowed suffix - ${suffixes}`
      )
      return
    }

    // Check if title pass regex
    const regex = RegExp(core.getInput("regex"))
    if (!regex.test(title)) {
      core.setFailed(
        `Pull Request title "${title}" failed to pass match regex - ${regex}`
      )
      return
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
