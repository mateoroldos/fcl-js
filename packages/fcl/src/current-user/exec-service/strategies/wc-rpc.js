import {wc} from "./utils/wc"
import {normalizePollingResponse} from "../../normalize/polling-response"

export function execWcRPC(service, body, opts, config) {
  return new Promise((resolve, reject) => {
    wc(service, {
      async onReady(_, {send}) {
        try {
          send({
            jsonrpc: "2.0",
            method: "flow_authn",
            params: [body, service.params],
          })
        } catch (error) {
          throw error
        }
      },

      onResponse(data, {close}) {
        try {
          if (typeof data !== "object") return
          const resp = normalizePollingResponse(data)

          switch (resp.status) {
            case "APPROVED":
              resolve(resp.data)
              close()
              break

            case "DECLINED":
              reject(`Declined: ${resp.reason || "No reason supplied"}`)
              close()
              break

            case "REDIRECT":
              resolve(resp)
              close()
              break

            default:
              reject(`Declined: No reason supplied`)
              close()
              break
          }
        } catch (error) {
          console.error("execExtRPC onResponse error", error)
          throw error
        }
      },

      onClose(_, {close}) {
        reject(`Declined: Externally Halted`)
      },
    })
  })
}
