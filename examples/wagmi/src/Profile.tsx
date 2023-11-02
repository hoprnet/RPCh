import { useAccount, useBlockNumber, useConnect, useDisconnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { CLIENT_SECRET } from './config'

export default function Profile() {
  const { address, isConnected } = useAccount()
  const { data: block, error } = useBlockNumber()
  const { connect } = useConnect({
    connector: new InjectedConnector(),
  })
  const { disconnect } = useDisconnect()
  console.log({ block })
  if (isConnected)
    return (
      <div>
        <div>{CLIENT_SECRET === 'PleaseChangeMe' && `Please change the client secret in config`}</div>
        <div>Connected to {address}</div>
        <div>Block: {block?.toString()}</div>
        <div>{error && `Block error: ${error.message}` }</div>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    )
  return <button onClick={() => connect()}>Connect Wallet</button>
}
