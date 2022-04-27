const core = require('@actions/core');
const github = require('@actions/github');

// This is the main graphql query that we issue
// we do not filter here but rather get all package version
// and then use a filter on the results
//
// Note that this is double pagination and we need to deal with
// both cursors
const VERSIONS_QUERY = `query Versions($repo: String!, $owner:String!, $cursor_packages:String, $cursor_versions:String) { 
    repository(name: $repo, owner: $owner) {
      packages(first:100, after: $cursor_packages) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          versions(first: 100, after: $cursor_versions) {
            pageInfo {
              endCursor
              hasNextPage
            }              
            nodes {
              id
              version
            }
          }
        }
      }
    }
}`;

/**
 *
 * @param octokit The octokit instance
 * @param repo The repo
 * @param owner The ownser
 * @param cursor_packages The packages cursor
 * @param cursor_versions The versions cursor
 * @return {Promise<*>} The raw response
 */
async function query(octokit, repo, owner, cursor_packages, cursor_versions) {
  return octokit.graphql(
      VERSIONS_QUERY,
      {
        repo,
        owner,
        cursor_packages,
        cursor_versions
      },
  );
}

/**
 * Takes the response from `query()` and a regex matcher and
 * returns all version ids in the response where the version matches
 *
 * @param response The raw responses
 * @param matcher The regex matcher
 * @return {string[]} The version ids where the version matches
 */
function getIds(response, matcher) {
  return response.repository.packages.nodes
      .map(i => i.versions)
      .flatMap(i => i.nodes)
      .filter(i => i !== null)
      .filter(i => matcher.test(i.version))
      .map(i => i.id)
}

/**
 * Takes the raw response from `query` and returns all version cursors
 * if there are any
 *
 * @param response The response
 * @return {string[]} All version cursors of empty array
 */
function versionCursors(response) {
  return response.repository.packages.nodes
      .map(i => i.versions)
      .flatMap(i => i.pageInfo)
      .filter(i => i.hasNextPage)
      .map(i => i.endCursor)
}

/**
 * Takes the raw response from `query` and returns all
 * package cursors
 *
 * @param response The raw response
 * @return {string[]} All package cursors if there are any
 */
function packagesCursors(response) {
  return [response.repository.packages.pageInfo]
      .filter(i => i.hasNextPage)
      .map(i => i.endCursor)
}


async function fetchIds(token, version) {
  const octokit = github.getOctokit(token)
  const {owner, repo} = github.context.repo
  // the matcher for the version string
  const matcher = new RegExp('^' + version + '$')

  // We start with a null as the first package cursor
  let pkgCursors = [null];
  // we collect the final results here
  let versions = [];
  while (pkgCursors.length > 0) {
    for (const pc of pkgCursors) {
      let response = await query(octokit, repo, owner, pc, null);
      pkgCursors = packagesCursors(response);
      versions = versions.concat(getIds(response, matcher));
      for (const c of versionCursors(response)) {
        response = await query(octokit, repo, owner, pc, c);
        versions = versions.concat(getIds(response, matcher));
      }
    }
  }

  let results = [...new Set(versions)]
  console.log(">> RESULTS ", JSON.stringify(results, null, 2))
  return results
}

async function main() {
  try {
    const version = core.getInput('version');
    const token = core.getInput('token') || process.env.GITHUB_TOKEN;
    core.info(`Fetch IDs for ${version}`)
    const ids = await fetchIds(token, version);
    core.info(`Found ${ids.length} ids for version '${version}': ${ids.join(',')}`)
    core.setOutput("ids", ids.join(','));
  } catch (error) {
    console.log(error)
    core.setFailed(error.message);
  }
}

main()

