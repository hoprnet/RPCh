# Discovery platform

For the RPCh SDK to be usable, it needs to know which HOPRd entry nodes and HOPRd exit nodes it can use. The discovery platform requires participants in the RPCh network to be registered, that way, it can provide the RPCh SDK with a list of participants.
Additionally, the discovery platform maintains an honesty score which may exclude a registered node if proven to be dishonest, ensuring that clients which use the RPCh SDK have reliable connections to the RPCh network.
Lastly, when a new node is registered in the discovery platform, the discovery platform is responsible for funding the nodes.
