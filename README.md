# Package Version IDs Actions

This action takes a version name, searches the package registry 
of the **the current repository** for packages with that version name
and returns a comma separated list of package-version-ids for these 
versions.

Primary motivation for this action is to make it work together with the
[delete-package-versions](https://github.com/actions/delete-package-versions)
action. That action takes a list of package-version-ids and can delete them,
but it can currently not filter by version name.

Note that the current implementation filters for the first 100 versions

## Inputs

## `version`

**Required** A regular expression that is matched against the name of the
version that is being searched for, i.e. `1.0.0-SNAPSHOT` for an exact match
or `.*-SNAPSHOT` for all snapshots.

## `token`

The access to token. The token must have permissions to read packages. Defaults 
to github.token.

## Outputs

## `ids`

A comma separated list of package version ids

## Example usage

```
- uses: castlabs/get-package-version-id-action@v2.0
  id: version
  with:
    version: "1.0-SNAPSHOT"
- uses: actions/delete-package-versions@v2
  if: ${{ steps.version.outputs.ids != '' }}
  with:
    package-version-ids: "${{ steps.versions.outputs.ids }}"

