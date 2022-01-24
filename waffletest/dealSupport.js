const ethers=require("ethers");
const {IERC20ABI}=require("./abi/IERC20")
const {IERC721ABI}=require("./abi/IERC721")
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");

function nameToSelector(name){
    const si= keccak256(toUtf8Bytes(name))
    const res=si.slice(0,10)
    return res
}
const selectorFixPriceDeal = nameToSelector('fixPriceDeal(bytes,address[7],uint8[2],uint256[6],bytes,bytes)')
const selectorEnglandAuction = nameToSelector('englandAuction(bytes,address[7],uint8[2],uint256[6],bytes,bytes)')
const selectorDutchAuction = nameToSelector('dutchAuction(bytes,address[7],uint8[2],uint256[6],bytes,bytes)')
const selectorFixDealer = nameToSelector('fixDealer(bytes,address[7],uint8[2],uint256[6],bytes,bytes)')

const selectorSplit = nameToSelector('split(bytes,address[7],uint8[2],uint256[6],bytes,bytes)')

const ERC20Selector = nameToSelector('transferERC20Exact(bytes,address[7],uint8,uint256[6],bytes)')

const ERC721Selector = nameToSelector('transferERC721Exact(bytes,address[7],uint8,uint256[6],bytes)')

function fixPriceDealPack(isSell,extra721,token,amount){
    const paramsSplit = ethers.utils.defaultAbiCoder.encode(
        ['bool', 'bytes', 'address','uint'],
        [
            isSell,
            extra721,token,amount]
    )
    return paramsSplit
}

function splitPack(staticiAddress,selectorA,selectorB,extradataA,extradataB){
    const paramsSplit = ethers.utils.defaultAbiCoder.encode(
        ['address[2]', 'bytes4[2]', 'bytes', 'bytes'],
        [[staticiAddress, staticiAddress],
            [selectorA, selectorB],
            extradataA, extradataB]
    )
    return paramsSplit
}


function erc20Verify(tokenAddress,amount){
    const erc20Params = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [tokenAddress, amount])
    return erc20Params
}

function erc721Verify(tokenAddress,tokenId){
    const secondEDParams = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [tokenAddress, tokenId])
    return secondEDParams
}

function sellNFTforERC20Extra(staticiAddress,nftAddress,nftTokenId,erc20Address,erc20Amount){
    let extraA = erc721Verify(nftAddress,nftTokenId)
    let extraB = erc20Verify(erc20Address,erc20Amount)
    return splitPack(staticiAddress,ERC721Selector,ERC20Selector,extraA,extraB)
}

function sellOrBuyFixedPriceExtra(isSell,nftAddress,nftTokenId,erc20Address,erc20Amount){
    let extraA = erc721Verify(nftAddress,nftTokenId)
    return fixPriceDealPack(isSell,extraA,erc20Address,erc20Amount)

}

function dutchAuctionExtra(buyToken,basePrice,deltaPrice,nftAddress,nftTokenId){
    let extraA = erc721Verify(nftAddress,nftTokenId)
    const paramsDutch = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint', 'uint', 'bytes'],
        [buyToken,basePrice,deltaPrice,extraA]
    )
    return paramsDutch
}

function englandAuctionExtra(buyToken,priceMin,nftAddress,nftTokenId){
    let extraA = erc721Verify(nftAddress,nftTokenId)
    const paramsEngland = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint', 'bytes'],
        [buyToken,priceMin,extraA]
    )
    return paramsEngland

}

function fixDealerWrapExtra(dealer,selector,extra){
    const paramsFixDealer = ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes4', 'bytes'],
        [dealer,selector,extra]
    )
    return paramsFixDealer
}

async function transfer721Calldata(nftAddress,from,to,tokenId){
    let c = new ethers.Contract(nftAddress,IERC721ABI)//todo import abi
    let callData = await c.populateTransaction.transferFrom(from, to, tokenId)
    return {target: nftAddress, howToCall: 1, data: callData}
}

async function transfer20Calldata(tokenAddress,from,to,amount){
    let c = new ethers.Contract(tokenAddress,IERC20ABI)//todo import abi
    let callData = await c.populateTransaction.transferFrom(from,to,amount)
    return {target: tokenAddress, howToCall: 1, data: callData}
}

async function payAndFeeParams(tokenAddress,amount,from,to,feeRecipient){
    let c = new ethers.Contract(tokenAddress,IERC20ABI)
    let amount1=ethers.BigNumber.from(amount).mul(5000).div(10000)
    let amount0=ethers.BigNumber.from(amount).sub(amount1)
    let payData = (await c.populateTransaction.transferFrom(from,to,amount0)).data
    let feeData = (await c.populateTransaction.transferFrom(from,feeRecipient,amount1)).data
    return [[tokenAddress,tokenAddress],[0,0],[(payData.length-2)/2,(feeData.length-2)/2],payData+feeData.slice(2)]
}
module.exports = {
    selectorSplit,sellNFTforERC20Extra,transfer721Calldata,transfer20Calldata,
    sellOrBuyFixedPriceExtra,dutchAuctionExtra,englandAuctionExtra,fixDealerWrapExtra,
    selectorFixPriceDeal,selectorEnglandAuction,selectorDutchAuction,selectorFixDealer,
    payAndFeeParams
}
