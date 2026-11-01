import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'

// The bucket the recorders publish to, and the CloudFront distribution in front
// of it.
const BUCKET = 's3://myloveydove.com'
const DISTRIBUTION = 'E18JD5XP4HQPUW'

// Copy a file to the bucket and drop CloudFront's cached copy of it.
//
// CloudFront keeps serving a file's old bytes until its cache entry expires, so
// a re-recorded clip uploaded over the old one is not what the site shows until
// the path is invalidated. The invalidation finishes on CloudFront's side a
// minute or so after this returns.
//
// `dest` is an s3:// key, or a prefix ending in `/` that the file's own name is
// appended to, the way `aws s3 cp` reads it.
export function publish(file, dest) {
  const key = dest.endsWith('/') ? `${dest}${basename(file)}` : dest
  const aws = args =>
    execFileSync('aws', [...args, '--profile', 'colin'], { stdio: 'inherit' })
  aws(['s3', 'cp', file, key, '--only-show-errors'])
  aws([
    'cloudfront',
    'create-invalidation',
    '--distribution-id',
    DISTRIBUTION,
    '--paths',
    key.slice(BUCKET.length),
    '--query',
    'Invalidation.Id',
    '--output',
    'text',
  ])
}
