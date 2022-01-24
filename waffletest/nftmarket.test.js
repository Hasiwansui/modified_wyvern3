const {expect, use} =require( 'chai');
const ets=require("ethers")
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");
const {deployContract, MockProvider, solidity} =require( 'ethereum-waffle');
const {signT,atomicMatch}=require("./support")
const WyvernAtomicizer = require('../build/WyvernAtomicizer.json')
const WyvernExchange = require('../build/WyvernExchange.json')
const WyvernStatic = require('../build/WyvernStatic.json')
const WyvernRegistry = require('../build/WyvernRegistry.json')
const TestERC20 = require('../build/TestERC20.json')
const TestERC721 = require('../build/TestERC721.json')
const TestERC1271 = require('../build/TestERC1271.json')
const CustomizeStiatic = require("../build/CustomizeStatic.json")
use(solidity);

const { wrap,hashOrder,ZERO_BYTES32,randomUint,NULL_SIG,assertIsRejected} = require('./sup');
const {fixDealerWrapExtra,sellOrBuyFixedPriceExtra,dutchAuctionExtra,englandAuctionExtra,selectorFixPriceDeal,selectorDutchAuction,selectorEnglandAuction,selectorFixDealer,payAndFeeParams} = require("./dealSupport")

function nameToSelector(name){
    const si= keccak256(toUtf8Bytes(name))
    const res=si.slice(0,10)
    return res
}

const personalSignPrefix = "\x19Ethereum Signed Message:\n"


describe('WyvernExchange', function(){
    const [wallet, walletTo] = new MockProvider({ganacheOptions:{gasLimit:"200000000"}}).getWallets();

    it('matches two nft + erc20 orders, real static call',async() => {
        let chainId=await wallet.getChainId()
        console.log("registry")
            
        let registry=await deployContract(wallet,WyvernRegistry)
        console.log("exchange")
        let exchange = await deployContract(wallet,WyvernExchange,[chainId,[registry.address],Buffer.from(personalSignPrefix,'binary')])
        console.log("atomicizaer")
        let atomicizer=await deployContract(wallet,WyvernAtomicizer)
        console.log("statici",atomicizer.address)
        let statici=await deployContract(wallet,WyvernStatic,[atomicizer.address],{gasLimit:ets.BigNumber.from("20000000")})
        let feeRecipient = "0xbB232ba1bB4E5B847F25117BaD1b68bc15466449"
        let customStatici=await deployContract(wallet,CustomizeStiatic,[wallet.address,atomicizer.address,feeRecipient])
        
        console.log("erc20")
        let erc20=await deployContract(wallet,TestERC20)
        console.log("erc721")
        let erc721=await deployContract(wallet,TestERC721)
        console.log("erc1271")
        let erc1271=await deployContract(wallet,TestERC1271)
        const aabi = [{'constant': false, 'inputs': [{'name': 'addrs', 'type': 'address[]'}, {'name': 'values', 'type': 'uint256[]'}, {'name': 'calldataLengths', 'type': 'uint256[]'}, {'name': 'calldatas', 'type': 'bytes'}], 'name': 'atomicize', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}]
        let atomicizerc=new ets.Contract(atomicizer.address,aabi)
        
        await registry.connect(wallet).grantInitialAuthentication(exchange.address)

        await registry.connect(walletTo).registerProxy()
        let proxy2 = await registry.proxies(walletTo.address)

        await erc20.connect(walletTo).approve(proxy2, 100000)
        await erc721.connect(walletTo).setApprovalForAll(proxy2, true)

        await registry.connect(wallet).registerProxy()
        let proxy = await registry.proxies(wallet.address)

        await erc20.connect(wallet).approve(proxy, 100000)
        await erc721.connect(wallet).setApprovalForAll(proxy, true)
        
        

        const amount = randomUint() + 4
        await erc20.mint(wallet.address,amount)
        let tokens=amount
        let nfts=[1, 2, 3]

        await erc721.connect(wallet).transferFrom(wallet.address,walletTo.address,nfts[0])

        
        const selectorOne = nameToSelector('split(bytes,address[7],uint8[2],uint256[6],bytes,bytes)')
        
        const selectorOneA = nameToSelector('sequenceExact(bytes,address[7],uint8,uint256[6],bytes)')
        
        const selectorOneB = nameToSelector('sequenceExact(bytes,address[7],uint8,uint256[6],bytes)')
        
        const firstEDSelector = nameToSelector('transferERC20Exact(bytes,address[7],uint8,uint256[6],bytes)')
        
        const firstEDParams = ets.utils.defaultAbiCoder.encode(['address', 'uint256'], [erc20.address, '4'])
        
        const secondEDSelector = nameToSelector('transferERC721Exact(bytes,address[7],uint8,uint256[6],bytes)')
        
        const secondEDParams = ets.utils.defaultAbiCoder.encode(['address', 'uint256'], [erc721.address, nfts[2]])
        
        const extradataOneA = ets.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'bytes4[]', 'bytes'],
        [[statici.address, statici.address],
            [(firstEDParams.length - 2) / 2, (secondEDParams.length - 2) / 2],
            [firstEDSelector, secondEDSelector],
            firstEDParams + secondEDParams.slice(2)]
        )

        const bEDParams = ets.utils.defaultAbiCoder.encode(['address', 'uint256'], [erc721.address, nfts[0]])
        
        const bEDSelector = nameToSelector('transferERC721Exact(bytes,address[7],uint8,uint256[6],bytes)')
        
        const extradataOneB = ets.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'bytes4[]', 'bytes'],
        [[statici.address], [(bEDParams.length - 2) / 2], [bEDSelector], bEDParams]
        )

        const paramsOneA = ets.utils.defaultAbiCoder.encode(
        ['address[2]', 'bytes4[2]', 'bytes', 'bytes'],
        [[statici.address, statici.address],
            [selectorOneA, selectorOneB],
            extradataOneA, extradataOneB]
        )
        const extradataOne = paramsOneA
        
        const selectorTwo = nameToSelector('any(bytes,address[7],uint8[2],uint256[6],bytes,bytes)')
        const extradataTwo = '0x'
        const one = {registry: registry.address, maker: wallet.address, staticTarget: statici.address, staticSelector: selectorOne, staticExtradata: extradataOne, maximumFill: '1', listingTime: '0', expirationTime: '10000000000', salt: '3352'}
        const two = {registry: registry.address, maker: walletTo.address, staticTarget: statici.address, staticSelector: selectorTwo, staticExtradata: extradataTwo, maximumFill: '1', listingTime: '0', expirationTime: '10000000000', salt: '3335'}
        const sig = NULL_SIG
        
        const firstERC20Call = (await erc20.populateTransaction.transferFrom(wallet.address, walletTo.address, 4)).data
        const firstERC721Call = (await erc721.populateTransaction.transferFrom(wallet.address, walletTo.address, nfts[2])).data
        const firstData = (await atomicizerc.populateTransaction.atomicize(
        [erc20.address, erc721.address],
        [0, 0],
        [(firstERC20Call.length - 2) / 2, (firstERC721Call.length - 2) / 2],
        firstERC20Call + firstERC721Call.slice(2)
        )).data
        
        const secondERC721Call = (await erc721.populateTransaction.transferFrom(walletTo.address, wallet.address, nfts[0])).data
        const secondData = (await atomicizerc.populateTransaction.atomicize(
        [erc721.address],
        [0],
        [(secondERC721Call.length - 2) / 2],
        secondERC721Call
        )).data
        
        const firstCall = {target: atomicizerc.address, howToCall: 1, data: firstData}
        const secondCall = {target: atomicizerc.address, howToCall: 1, data: secondData}
        
        let twoSig = await signT(chainId,exchange.address,two,walletTo)
        
        await atomicMatch(exchange,wallet,one, sig, firstCall, two, twoSig, secondCall, ZERO_BYTES32)
        //expect(as,"need success").not.to.be.reverted
        
        let bls=await erc20.balanceOf(walletTo.address)
        
        expect(bls,"should be equal").to.be.eq(4)
        
        let extract_one = sellOrBuyFixedPriceExtra(true,erc721.address,nfts[0],erc20.address,4)
        let order_one = {registry: registry.address, maker: wallet.address, staticTarget: customStatici.address, staticSelector: selectorFixPriceDeal, staticExtradata: extract_one, maximumFill: '1', listingTime: '0', expirationTime: '10000000000', salt: '3352'}
        
        let sig_one = await signT(chainId,exchange.address,order_one,wallet)
        
        let data_one = (await erc721.populateTransaction.transferFrom(wallet.address,walletTo.address,nfts[0])).data
        let call_one = {target: erc721.address, howToCall: 0, data: data_one}

        let extract_two = '0x'
        let order_two = {registry: registry.address, maker: walletTo.address, staticTarget: statici.address, staticSelector: selectorTwo, staticExtradata: extract_two, maximumFill: '1', listingTime: '0', expirationTime: '10000000000', salt: '3352'}

        let sig_two = NULL_SIG
        //todo fee
        let params = await payAndFeeParams(erc20.address,4,walletTo.address,wallet.address,feeRecipient)
        let data_two = (await atomicizerc.populateTransaction.atomicize(params[0],params[1],params[2],params[3])).data
        
        
        let call_two = {target:atomicizerc.address,howToCall:1,data: data_two}

        await atomicMatch(exchange,walletTo,order_one,sig_one,call_one,order_two,sig_two,call_two,ZERO_BYTES32)
        bls=await erc20.balanceOf(walletTo.address)

        expect(bls,"should be equal").to.be.eq(0)

        let extract_three = englandAuctionExtra(erc20.address,1,erc721.address,nfts[0])
        let order_three = {registry: registry.address, maker: walletTo.address, staticTarget: customStatici.address, staticSelector: selectorEnglandAuction, staticExtradata: extract_three, maximumFill: '1', listingTime: '0', expirationTime: '10000000000', salt: '3352'}
    
        let sig_three = await signT(chainId,exchange.address,order_three,walletTo)

        let data_three = (await erc721.populateTransaction.transferFrom(walletTo.address,wallet.address,nfts[0])).data
        let call_three = {target:erc721.address,howToCall:0,data:data_three}

        let extract_four = "0x"
        let order_four = {registry: registry.address, maker: wallet.address, staticTarget: statici.address, staticSelector: selectorTwo, staticExtradata: extract_four, maximumFill: '1', listingTime: '0', expirationTime: '10000000000', salt: '3352'}

        let sig_four = await signT(chainId,exchange.address,order_four,wallet)

        let params2 = await payAndFeeParams(erc20.address,4,wallet.address,walletTo.address,feeRecipient)
        let data_four = (await atomicizerc.populateTransaction.atomicize(params2[0],params2[1],params2[2],params2[3])).data
        let call_four = {target:atomicizerc.address,howToCall:1,data:data_four}

        await atomicMatch(exchange,wallet,order_three,sig_three,call_three,order_four,sig_four,call_four,ZERO_BYTES32)
        expect(await erc20.balanceOf(walletTo.address),"should be equal").to.be.eq(2)
    })

})