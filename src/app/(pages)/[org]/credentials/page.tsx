// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ChevronRightIcon, KeyRoundIcon, LockIcon, SparklesIcon } from 'lucide-react'

// Component Imports
import CodeBlock from '@/components/shared/CodeBlock'
import PageHeader from '@/components/shared/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AppleKeyForm from '@/views/credentials/apple-key-form'
import SavedCredential from '@/views/credentials/saved-credential'
import GoogleServiceAccountForm from '@/views/credentials/google-sa-form'

// Lib Imports
import { listCredentials } from '@/lib/server/credentials'
import { requireOrg } from '@/lib/server/orgs'
import { listProjects } from '@/lib/server/projects'

export const metadata = { title: 'Credentials' }
export const dynamic = 'force-dynamic'

const Guide = ({ steps }: { steps: React.ReactNode[] }) => (
  <ol className='space-y-2.5'>
    {steps.map((s, i) => (
      <li key={i} className='flex gap-3 text-sm'>
        <span className='bg-muted flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>{i + 1}</span>
        <span className='text-muted-foreground [&_b]:text-foreground [&_b]:font-medium'>{s}</span>
      </li>
    ))}
  </ol>
)

/** Manual steps, folded away: the CLI does most of this by itself. */
const ByHand = ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
  <details className='group rounded-lg border' open={open}>
    <summary className='hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden'>
      <ChevronRightIcon className='text-muted-foreground size-4 transition-transform group-open:rotate-90' />
      Set it up by hand instead
    </summary>
    <div className='space-y-6 border-t px-3 pt-4 pb-3'>{children}</div>
  </details>
)

const CredentialsPage = async ({ params }: { params: Promise<{ org: string }> }) => {
  const { org } = await requireOrg((await params).org)
  const creds = await listCredentials(org.id)
  const apple = creds.find(c => c.kind === 'apple_asc_key')
  const google = creds.find(c => c.kind === 'google_service_account')
  const keystores = creds.filter(c => c.kind === 'android_keystore')
  const projectSlug = new Map((await listProjects(org.id)).map(p => [p.id, p.slug]))
  const isOwner = org.role === 'owner'

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Credentials'
        description={`Store keys shared by every project in ${org.name}. One API key per store replaces Apple ID passwords, 2FA codes, certificates and provisioning profiles. Keys are encrypted and only handed to the CLI, never to the browser.`}
      />

      {!isOwner && (
        <Alert>
          <LockIcon />
          <AlertDescription>Only organization owners can add or replace credentials. Your builds still use them.</AlertDescription>
        </Alert>
      )}

      {isOwner && (!apple || !google) && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <SparklesIcon className='size-4' /> Let the CLI set them up
            </CardTitle>
            <CardDescription>Run this in your Expo project. It asks only for what it can’t find by itself.</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]'>
            <div className='space-y-2'>
              <CodeBlock code='npx localxpo credentials' />
              <p className='text-muted-foreground text-xs'>
                <code className='font-mono'>npx localxpo link</code> runs it too. Add <code className='font-mono'>-p ios</code> or{' '}
                <code className='font-mono'>-p android</code> for one store.
              </p>
            </div>
            <ul className='text-muted-foreground grid gap-2 text-sm sm:grid-cols-2 [&_b]:text-foreground [&_b]:font-medium'>
              <li>
                <b>From EAS</b> (if you ran <code className='font-mono'>eas login</code>): Android upload keys, Apple Key ID, Issuer ID and team.
              </li>
              <li>
                <b>From this machine</b>: .p8 and service-account files in eas.json, fastlane, ~/.appstoreconnect, the project, Downloads.
              </li>
              <li>
                <b>Apple</b>: opens App Store Connect, catches the .p8 download, reads the Key ID from its name and the Issuer ID from your
                clipboard, gets the Team ID from Apple, and checks each app exists.
              </li>
              <li>
                <b>Google</b>: creates the service account with gcloud (or catches the downloaded key), then checks Play access and walks you
                through the one invite only you can do.
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      <div className='grid gap-6 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Apple · App Store Connect API key</CardTitle>
            <CardDescription>Lets Xcode create certificates and provisioning profiles by itself, and upload to TestFlight.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            {apple && (
              <SavedCredential
                c={apple}
                orgSlug={org.slug}
                canDelete={isOwner}
                lines={[
                  ['Key ID', apple.meta.keyId],
                  ['Issuer ID', apple.meta.issuerId]
                ]}
                warning='Delete the App Store Connect key? iOS builds will fall back to the Apple account signed in to Xcode.'
              />
            )}
            {!apple && <p className='text-muted-foreground text-sm'>Not configured yet.</p>}
            {isOwner && (
              <ByHand>
                <Guide
                  steps={[
                    <>
                      Open <b>App Store Connect → Users and Access → Integrations → App Store Connect API</b>. (Account Holder: request
                      access once if the tab is empty.)
                    </>,
                    <>
                      Click <b>+</b>, name it “localxpo”, choose the <b>App Manager</b> role (or Admin), then <b>Generate</b>.
                    </>,
                    <>
                      Copy the <b>Issuer ID</b> (top of the page) and the key’s <b>Key ID</b>, then <b>Download</b> the .p8 file. Apple shows
                      the download only once.
                    </>,
                    <>
                      Find your <b>Team ID</b> at developer.apple.com → Account → <b>Membership details</b>.
                    </>
                  ]}
                />
                <AppleKeyForm orgSlug={org.slug} hasExisting={!!apple} />
              </ByHand>
            )}
          </CardContent>
        </Card>

        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Google Play · service account</CardTitle>
              <CardDescription>Lets the CLI upload .aab files to your internal, beta or production track.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {google && (
                <SavedCredential
                  c={google}
                  orgSlug={org.slug}
                  canDelete={isOwner}
                  lines={[['Google Cloud project', google.meta.projectId || '—']]}
                  warning='Delete the Google service account key? Android builds will no longer upload to Play.'
                />
              )}
              {!google && <p className='text-muted-foreground text-sm'>Not configured yet.</p>}
              {isOwner && (
                <ByHand>
                  <Guide
                    steps={[
                      <>
                        In <b>Google Cloud Console → IAM → Service accounts</b>, create a service account (no roles needed) and enable the{' '}
                        <b>Google Play Android Developer API</b> for that project.
                      </>,
                      <>
                        Open the account → <b>Keys → Add key → JSON</b>. A .json file downloads.
                      </>,
                      <>
                        In <b>Play Console → Users and permissions → Invite new user</b>, paste the service account email and give it{' '}
                        <b>Release</b> permissions for your app.
                      </>,
                      <>
                        Google requires the <b>very first</b> .aab of a new app to be uploaded by hand in Play Console. After that, every upload
                        can come from the CLI.
                      </>
                    ]}
                  />
                  <GoogleServiceAccountForm orgSlug={org.slug} hasExisting={!!google} />
                </ByHand>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Android upload keystores</CardTitle>
              <CardDescription>
                One per app package: imported from EAS when the app was built there, otherwise generated on its first release build. Backed up
                here, so a lost laptop doesn’t mean a lost app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {keystores.length === 0 ? (
                <div className='text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm'>
                  <KeyRoundIcon className='size-4 shrink-0' />
                  <span>
                    None yet. <code className='font-mono'>npx localxpo credentials</code> imports yours from EAS, or the first{' '}
                    <code className='font-mono'>npx localxpo build -p android</code> creates one.
                  </span>
                </div>
              ) : (
                <div className='space-y-3'>
                  {keystores.map(k => (
                    <div key={k.id} className='space-y-1'>
                      <SavedCredential
                        c={{ ...k, label: k.project_name ? `${k.project_name} · ${k.meta.androidPackage ?? ''}` : k.label }}
                        orgSlug={org.slug}
                        canDelete={isOwner}
                        lines={[
                          ['Alias', k.meta.keyAlias],
                          ['SHA-1', k.meta.sha1 ?? '—']
                        ]}
                        warning='Delete this keystore backup? If it is also lost on your machine, you will need Google Play support to reset your upload key.'
                      />
                      {k.project_id && projectSlug.get(k.project_id) && (
                        <Link href={`/${org.slug}/projects/${projectSlug.get(k.project_id)}/settings`} className='text-muted-foreground px-1 text-xs hover:underline'>
                          Project settings →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CredentialsPage
