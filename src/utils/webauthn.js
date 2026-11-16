export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    Boolean(navigator.credentials)
  )
}

export function base64UrlToUint8Array(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function mapCredentialDescriptors(descriptors) {
  if (!Array.isArray(descriptors)) {
    return undefined
  }
  return descriptors.map((item) => ({
    ...item,
    id: base64UrlToUint8Array(item.id),
  }))
}

export function formatWebAuthnError(err) {
  if (!err) {
    return 'Passkey operation failed.'
  }
  if (err.name === 'NotAllowedError') {
    return 'Passkey prompt was cancelled or timed out.'
  }
  if (err.name === 'InvalidStateError') {
    return 'This passkey is already registered on this device.'
  }
  if (err.name === 'SecurityError') {
    return 'Passkeys require a valid domain origin (for example http://localhost:5173).'
  }
  return err.message || 'Passkey operation failed.'
}

export async function createPasskeyCredential(options) {
  const publicKey = {
    ...options,
    challenge: base64UrlToUint8Array(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToUint8Array(options.user.id),
    },
    ...(options.excludeCredentials
      ? { excludeCredentials: mapCredentialDescriptors(options.excludeCredentials) }
      : {}),
  }

  const credential = await navigator.credentials.create({ publicKey })
  if (!credential) {
    throw new Error('No passkey credential was returned by the browser.')
  }

  const transports =
    typeof credential.response.getTransports === 'function'
      ? credential.response.getTransports()
      : []

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
      attestationObject: arrayBufferToBase64Url(
        credential.response.attestationObject
      ),
      transports,
    },
  }
}

export async function getPasskeyAssertion(options) {
  const publicKey = {
    ...options,
    challenge: base64UrlToUint8Array(options.challenge),
    ...(options.allowCredentials
      ? { allowCredentials: mapCredentialDescriptors(options.allowCredentials) }
      : {}),
  }

  const credential = await navigator.credentials.get({ publicKey })
  if (!credential) {
    throw new Error('No passkey assertion was returned by the browser.')
  }

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
      authenticatorData: arrayBufferToBase64Url(
        credential.response.authenticatorData
      ),
      signature: arrayBufferToBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle
        ? arrayBufferToBase64Url(credential.response.userHandle)
        : null,
    },
  }
}
