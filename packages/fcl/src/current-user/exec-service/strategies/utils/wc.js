import {config} from "@onflow/config"

const noop = () => {}

const DEFAULT_APP_METADATA = {
  name: "Flow App",
  description: "Flow DApp for WalletConnect",
  url: "https://testFlow.com/",
  icons: ["https://avatars.githubusercontent.com/u/62387156?s=280&v=4"],
}

const checkPersistedState = async client => {
  let pairings, storedSession
  if (typeof client === "undefined") {
    throw new Error("WalletConnect is not initialized")
  }
  if (client.pairing.topics.length) {
    pairings = client.pairing.values
  }
  if (client.session?.topics.length) {
    storedSession = await client.session.get(client.session.topics[0])
  }
  return {pairings, storedSession}
}

const connectWc = async client => {
  try {
    const session = await client.connect({
      metadata: DEFAULT_APP_METADATA,
      //pairing: client.pairing.topics.length ? client.pairing.topics[0] : null,
      permissions: {
        blockchain: {
          chains: ["flow:testnet"],
        },
        jsonrpc: {
          methods: ["flow_authn", "flow_authz", "flow_signMessage"],
        },
      },
    })
    return session
  } catch (e) {
    console.error(e)
  }
}

export async function wc(service, body, opts = {}) {
  if (service == null) return {send: noop, close: noop}

  const onReady = opts.onReady || noop
  const onResponse = opts.onResponse || noop
  const onClose = opts.onClose || noop
  const {client, QRCodeModal} = await config.get("wc.adapter")
  const {pairings, storedSession} = await checkPersistedState(client)

  const send = msg => {
    try {
      console.log("Send", msg)
    } catch (error) {
      console.error("Ext Send Error", msg, error)
    }
  }

  const close = () => {
    try {
      onClose()
    } catch (error) {
      console.error("Ext Close Error", error)
    }
  }

  // if pairings === true, need user input, openPairingModal() to select?
  let session = storedSession
  if (session == null) {
    session = await connectWc(client)
  }

  if (service.endpoint === "flow_authn") {
    try {
      console.log("<--- handle Authn -->", service.endpoint)
      const result = await client.request({
        topic: session.topic,
        request: {
          method: service.endpoint,
          params: [],
        },
      })
      onResponse(result, {
        close: () => QRCodeModal.close(),
      })
    } catch (e) {
      console.error(e)
    }
  }

  if (service.endpoint === "flow_authz") {
    try {
      console.log("<--- handle Authz -->")
      const result = await client.request({
        topic: session.topic,
        request: {
          method: service.endpoint,
          params: [body],
        },
      })

      onResponse(result, {
        close: () => QRCodeModal.close(),
      })
    } catch (e) {
      console.error(e)
    }
  }

  return {send, close}
}
