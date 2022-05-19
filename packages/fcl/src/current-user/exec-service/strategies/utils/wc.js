import {config} from "@onflow/config"

const noop = () => {}

const DEFAULT_APP_METADATA = {
  name: "Flow App",
  description: "Flow DApp for WalletConnect",
  url: "https://testFlow.com/",
  icons: ["https://avatars.githubusercontent.com/u/62387156?s=280&v=4"],
}

const services = [
  {
    f_type: "Service",
    f_vsn: "1.0.0",
    type: "authn",
    uid: "fcl-wc#authn",
    endpoint: "flow_authn",
    id: "0xf8d6e0586b0a20c7",
    identity: {
      address: "0xf8d6e0586b0a20c7",
    },
    provider: {
      address: null,
      name: "Flow WC Wallet",
      icon: null,
      description: "A Flow enabled WC Wallet",
    },
  },
  {
    f_type: "Service",
    f_vsn: "1.0.0",
    type: "authz",
    uid: "fcl-wc#authz",
    endpoint: "flow_authz",
    method: "WC/RPC",
    identity: {
      address: "0xf8d6e0586b0a20c7",
      keyId: 0,
    },
  },
]

const checkPersistedState = async client => {
  let pairings, storedSession
  if (typeof client === "undefined") {
    throw new Error("WalletConnect is not initialized")
  }
  if (client.pairing.topics.length) {
    pairings = client.pairing.values
  }
  // populates existing session to state (assume only the top one)
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

  // if pairings === true, need user input, openPairingModal() to select;
  let session = storedSession
  if (session == null) {
    session = await connectWc(client)
  }

  if (service.endpoint === "flow_authn") {
    try {
      console.log("<--- handle Authn -->")
      const result = await client.request({
        topic: session.topic,
        request: {
          method: "flow_authn",
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
          method: "flow_authz",
          params: [body, service.params, service.data, service.type],
        },
      })

      onResponse(
        {
          f_type: "PollingResponse",
          f_vsn: "1.0.0",
          type: "FCL:VIEW:RESPONSE",
          status: "APPROVED",
          reason: null,
          data: {
            f_type: "CompositeSignature",
            f_vsn: "1.0.0",
            addr: "0xf8d6e0586b0a20c7",
            keyId: 0,
            signature:
              "fa74eb89ba9bc7b181e24dbfe1a50e5d02e4aa1d5e4a2421e55dd86ff35e8e4aa960c6baa6554439167e59fcad1701f6aa23f811934140e3be75f41a63459e37",
          },
        },
        {
          close: () => QRCodeModal.close(),
        }
      )
    } catch (e) {
      console.error(e)
    }
  }

  return {send, close}
}
