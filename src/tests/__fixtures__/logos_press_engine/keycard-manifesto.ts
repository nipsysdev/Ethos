export default `**Self-custody** offers a response. It is not only about securing assets but about enabling people to participate in networks and digital communities on their own terms. It is the foundation of digital sovereignty, and without it, no decentralised governance model can offer meaningful guarantees of autonomy. Tools that support self-custody must therefore be transparent, resilient, and open – available to all and owned by no one.

Why self-custody needs to be reclaimed
--------------------------------------

Technically speaking, storing keys on a mobile phone or desktop computer does qualify as self-custody. The user holds their private keys, often in a locally stored keystore or encrypted vault. But these platforms are inherently vulnerable: they are connected to the Internet, regularly run untrusted code, and are exposed to a wide array of attack vectors. While convenient, they offer a weak guarantee of operational security and lack the focused protection that dedicated hardware can provide.

Hardware wallets attempt to fill this gap. They isolate the keys from the broader software environment, limit communication interfaces, and use hardened hardware. But **most current implementations have significant flaws** that limit their reliability, trustworthiness, and interoperability:

First, many are not fully open source. Without public code and schematics, it is impossible to independently audit their behaviour or verify their integrity. Second, their architectures are frequently opaque. While they include a secure element, the actual signing operation often takes place on a less secure microcontroller. This breaks the chain of trust that the secure element is supposed to guarantee.

Third, they impose vendor-specific applications at least for setup and settings. This locks users into a proprietary ecosystem that may not align with their values or privacy expectations. Fourth, they rely on custom APIs that are incompatible with each other, fragmenting support across wallets and DApps.

Fifth, their physical design introduces fragility. Devices often rely on internal batteries or soldered components. When a battery dies, the device is effectively unusable, even if the secure element is intact. Finally, and most importantly, the user’s private keys are tightly bound to the device and can’t be used with any other device. Also, if the part of the firmware accessing private keys is remotely upgradable, the rules for how those keys are used can be [changed remotely](https://thedefiant.io/news/nfts-and-web3/ledger-s-new-wallet-recovery-feature-sparks-community-backlash), either by the vendor or under external pressure. In such a system, the user’s autonomy is conditional.

We envision a different world: one where you use your keys across any hardware or software wallet, mobile or desktop device, payment system or DApp – **your keys, your rules**.

A new paradigm: Breaking the hardware wallet monolith
-----------------------------------------------------

The traditional hardware wallet model is monolithic: a single device handles key storage, signing, interface, and logic. By separating these roles, systems can become more secure, flexible, and composable.

In this architecture, the secure element does one thing: it holds private keys and performs cryptographic signatures. It is minimal, isolated, and designed to resist both physical and logical attacks. User interfaces – screens, keyboards, QR readers – are modular and interchangeable. Communication happens over standard, inspectable channels like QR codes or NFC. The result is a clearer threat model, greater modularity, and more resilient design.

Smart cards, and particularly JavaCards, are a mature and elegant solution for the secure element role. These cards are already used by billions of people in banking and telecommunication, and their security certifications (often EAL6+) reflect a high degree of confidence. JavaCard is one of the few secure element platforms that supports open development. Developers can write, publish, and audit applets that run on the card. Multiple vendors produce compatible cards, ensuring supply diversity.

Another key advantage of JavaCards is their native NFC capability. A card can be tapped against a smartphone or terminal to sign a transaction – no pairing, no drivers, no complexity. This makes JavaCards uniquely suited for mobile crypto usage and for integration into broader systems like payment terminals, identity checkpoints, and physical access controls.

They are also extremely practical. They contain no batteries, are immune to data loss due to power failure, and can last over 20 years. Physically, they are compact, water-resistant, and durable. They require no maintenance and cost just a few dollars. They are discreet, interoperable, and robust – a fitting platform for long-term key custody.

Building blocks for sovereign hardware
--------------------------------------

[Keycard](https://keycard.tech/keycard) is a fully open-source JavaCard applet that turns an ordinary smartcard into a secure signing device. It stores private keys, enforces PIN protection, and performs cryptographic operations. It is minimal by design.

[Shell](https://keycard.tech/keycard-shell) is a modular, open-source hardware wallet that uses Keycard as its secure element. It includes a screen, keyboard, camera, and power source, but never accesses the private key directly. It reads transactions via QR codes or USB, displays them clearly on-screen, and then prompts Keycard to sign them securely. Shell supports QR standards such as [ERC-4527](https://eips.ethereum.org/EIPS/eip-4527) and [UR2.0](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md), allowing smooth integration with many existing wallets across both EVM-compatible chains and Bitcoin.

Shell is fully open source (from software to hardware and casing), under a permissive MIT license, and its design is offered as a gift to the community – an open reference design to demonstrate how hardware wallets can evolve. It is not meant to lock users into a new ecosystem, but rather to inspire forks, adaptations, and improvements. It is a tool to advance best practices in the hardware wallet space and to encourage better architectures that reflect the principles of transparency, portability, and autonomy.

Together, Keycard and Shell provide a secure, modular foundation for self-custody that any project or user can adopt. They are public goods: freely available, community-owned, and built for integration.

A community-centric model
-------------------------

A modular, permissionless hardware stack only makes sense if anyone can build on it. That is why we are nurturing a community of self-custody enthusiasts: security researchers, web3 builders, privacy advocates, hardware tinkerers, and software wallet developers.

**This community already exists**. [Many projects](https://github.com/keycard-tech/keycard-ecosystem-projects/) are already building on Keycard. We invite manufacturers to produce their own JavaCard variants. We invite projects to adopt the Keycard API. We invite hardware and software wallets to integrate with it, browser wallets to support it, and payment systems to accept it.

This project is for anyone who believes users should control their own keys securely and across any device. The goal is to grow an open ecosystem that serves real users, expands what’s possible, and reflects the values of self-custody.

The [Keycard API](https://keycard.tech/docs/apdu) is the core of this vision. It’s a simple, shared interface that enables hardware and software to work together. It’s not controlled by anyone. It’s a common good – open, minimal, and reliable.

To encourage trust without central gatekeepers, **we support the formation of a card alliance**: an open registry where card manufacturers can publish their certificate authorities. Anyone can check where a card comes from – no approvals needed.

Imagine the world this unlocks: users carry their secure element, in the form of a card, and use it wherever they like. They tap to sign on mobile, scan QR codes with a Shell-like device, insert their card into a USB reader for desktop use, or perform transactions with a tap at payment terminals. Even existing hardware wallets with NFC, like Ledger or Coldcard, could offer card-based signing as an option on top of their current scheme.

In the future we’re aiming towards, users themselves can truly own, build, and verify the secure element they want to use with their software or hardware wallets. JavaCards allow just that: they can be purchased blank, programmed with a trusted applet like the [Keycard applet](https://github.com/keycard-tech/status-keycard/releases), and locked to prevent further changes.

Why it matters for Logos
------------------------

[Logos](https://logos.co/) is not just a stack of technologies – it is an invitation to form decentralised, self-sovereign communities. These communities rely on cryptographic tools to coordinate, govern, and transact. But such coordination is only as strong as the keys that secure it. Without user-controlled private keys, no Logos application can offer true autonomy.

Keycard provides a solution to this. It enables citizens of a network state to hold their own keys, participate in their own governance, and access their own data, without asking permission from any intermediary.

Beyond function, Keycard can act as a symbol of belonging. In any community, **physical tokens reinforce identity**. A Keycard can be designed to reflect a specific network state’s culture, values, or membership. It can be used as an access credential, a voting token, or a governance tool. It becomes a badge not just of access, but of alignment.

Combined with Shell or used with a smartphone, Keycard offers a secure, intuitive gateway to all of Logos’ services. If integrated with [Nomos](https://nomos.tech/), [Waku](https://waku.org/), or [Codex](https://codex.storage/) nodes, it can also serve as a hardware secure module that secures the infrastructure itself. It’s not just a tool for users – it’s a trust anchor for the entire ecosystem.

In closing
----------

Self-custody is the cornerstone of digital freedom. Tools that facilitate it must be open, secure, and simple to use. Keycard and Shell embody these principles, not as products to be owned, but as public goods to be shared.

The future of digital sovereignty depends on infrastructures that anyone can use, fork, extend, and trust. These tools are a small part of that larger vision. They are available now. They are free. They are yours.

If you believe in such a vision, you are already part of it.

_Join the_ [_Logos community_](https://discord.gg/logosnetwork)_,_ [_preorder Keycard Shell_](https://keycard.tech/)_, and help us_ [_build Keycard together_](https://github.com/keycard-tech)_._`;
