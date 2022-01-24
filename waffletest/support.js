const ets = require("ethers")

const SOrder = {
    Order: [
    { name: 'registry', type: 'address' },
    { name: 'maker', type: 'address' },
    { name: 'staticTarget', type: 'address' },
    { name: 'staticSelector', type: 'bytes4' },
    { name: 'staticExtradata', type: 'bytes' },
    { name: 'maximumFill', type: 'uint256' },
    { name: 'listingTime', type: 'uint256' },
    { name: 'expirationTime', type: 'uint256' },
    { name: 'salt', type: 'uint256' }
    ]
}

signT = async(chainId,exchangeaddress,order,account) => {
    const Domain = {
        name:'Wyvern Exchange',
        version:'3.1',
        chainId:chainId,
        verifyingContract:exchangeaddress
    }
    let sig = await account._signTypedData(Domain,SOrder,order)
    return ets.utils.splitSignature(sig)
}

atomicMatch=async(contract,signer,order, sig, call, counterorder, countersig, countercall, metadata) => {
    let sss=ets.utils.defaultAbiCoder.encode(['bytes', 'bytes'], 
        [ets.utils.defaultAbiCoder.encode(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s])+ (sig.suffix || ''),
        ets.utils.defaultAbiCoder.encode(['uint8', 'bytes32', 'bytes32'], [countersig.v, countersig.r, countersig.s])+(countersig.suffix || '')]
    )
    await contract.connect(signer).atomicMatch_(
    [order.registry, order.maker, order.staticTarget, order.maximumFill, order.listingTime, order.expirationTime, order.salt, call.target,
      counterorder.registry, counterorder.maker, counterorder.staticTarget, counterorder.maximumFill, counterorder.listingTime, counterorder.expirationTime, counterorder.salt, countercall.target],
    [order.staticSelector, counterorder.staticSelector],
    order.staticExtradata, call.data, counterorder.staticExtradata, countercall.data,
    [call.howToCall, countercall.howToCall],
    metadata,sss
)}
module.exports ={
    signT,atomicMatch
}