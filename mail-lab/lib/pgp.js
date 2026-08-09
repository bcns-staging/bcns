// Real OpenPGP via the `openpgp` library: genuine RSA keypairs, genuine
// hybrid encryption, genuine digital signatures. Unlike S/MIME's
// CA-rooted trust model, PGP trusts individual keys directly ("web of
// trust") -- there's no certificate authority at all.
const openpgp = require('openpgp');

async function generateKeyPair({ name, email, passphrase }) {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'rsa',
    rsaBits: 2048,
    userIDs: [{ name, email }],
    passphrase: passphrase || undefined,
    format: 'armored',
  });
  return { privateKey, publicKey };
}

async function encrypt({ text, publicKeyArmored, signingPrivateKeyArmored, passphrase }) {
  const message = await openpgp.createMessage({ text });
  const encryptionKeys = await openpgp.readKey({ armoredKey: publicKeyArmored });
  let signingKeys;
  if (signingPrivateKeyArmored) {
    const priv = await openpgp.readPrivateKey({ armoredKey: signingPrivateKeyArmored });
    signingKeys = passphrase ? await openpgp.decryptKey({ privateKey: priv, passphrase }) : priv;
  }
  return openpgp.encrypt({ message, encryptionKeys, signingKeys });
}

async function decrypt({ armoredMessage, privateKeyArmored, passphrase, publicKeyArmoredForVerify }) {
  const priv = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const decryptionKeys = passphrase ? await openpgp.decryptKey({ privateKey: priv, passphrase }) : priv;
  const message = await openpgp.readMessage({ armoredMessage });
  const verificationKeys = publicKeyArmoredForVerify ? await openpgp.readKey({ armoredKey: publicKeyArmoredForVerify }) : undefined;
  const result = await openpgp.decrypt({ message, decryptionKeys, verificationKeys, expectSigned: !!verificationKeys });

  let signatureValid = null;
  if (verificationKeys && result.signatures?.length) {
    try {
      await result.signatures[0].verified;
      signatureValid = true;
    } catch {
      signatureValid = false;
    }
  }
  return { data: result.data, signatureValid };
}

async function sign({ text, privateKeyArmored, passphrase }) {
  const priv = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const signingKeys = passphrase ? await openpgp.decryptKey({ privateKey: priv, passphrase }) : priv;
  const message = await openpgp.createCleartextMessage({ text });
  return openpgp.sign({ message, signingKeys });
}

async function verify({ armoredSignedMessage, publicKeyArmored }) {
  const verificationKeys = await openpgp.readKey({ armoredKey: publicKeyArmored });
  const message = await openpgp.readCleartextMessage({ cleartextMessage: armoredSignedMessage });
  const result = await openpgp.verify({ message, verificationKeys });
  let valid = false;
  let reason = null;
  try {
    await result.signatures[0].verified;
    valid = true;
  } catch (err) {
    reason = err.message;
  }
  return { valid, reason, text: result.data };
}

module.exports = { generateKeyPair, encrypt, decrypt, sign, verify };
