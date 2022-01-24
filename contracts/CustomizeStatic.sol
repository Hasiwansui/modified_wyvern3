pragma solidity 0.7.5;

import "./static/StaticERC20.sol";
import "./static/StaticERC721.sol";
import "../lib/StaticCaller.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
contract CustomizeStatic is StaticERC20,StaticERC721,StaticCaller{
    address public englandAuctionOperator;
    address public atomicizer;
    address public feeRecipient;
    uint public immutable feeRate = 5000;
    using SafeMath for uint;
    constructor (address _englandBidOperator,address _atomicizer,address _feeRecipient)
    {
        englandAuctionOperator = _englandBidOperator;
        atomicizer = _atomicizer;
        feeRecipient = _feeRecipient;
    }


    function fixPriceDeal(bytes memory extra,
                   address[7] memory addresses, AuthenticatedProxy.HowToCall[2] memory howToCalls, uint[6] memory uints,
                   bytes memory data, bytes memory counterdata)
        public
        view
        returns (uint)
    {
        (bool isSell,bytes memory firstExtradata, address token, uint amount) = abi.decode(extra, (bool, bytes, address, uint));
        bytes memory secondExtradata= abi.encode(token,amount,true);
        if(isSell){
            StaticERC721.transferERC721Exact(firstExtradata,addresses, howToCalls[0], uints, data);
            payAndFeeERC20(secondExtradata, [addresses[3], addresses[4], addresses[5], addresses[0], addresses[1], addresses[2], addresses[6]], howToCalls[1], uints, counterdata);
        }else{
            payAndFeeERC20(secondExtradata,addresses, howToCalls[0], uints, data);
            StaticERC721.transferERC721Exact(firstExtradata, [addresses[3], addresses[4], addresses[5], addresses[0], addresses[1], addresses[2], addresses[6]], howToCalls[1], uints, counterdata);
        }
        return 1;
    }

    function englandAuction(bytes memory extra,
                   address[7] memory addresses, AuthenticatedProxy.HowToCall[2] memory howToCalls, uint[6] memory uints,
                   bytes memory data, bytes memory counterdata)
        public
        view
        returns (uint)
    {
        require(tx.origin==englandAuctionOperator,"ONLY EXCHANGE CAN VALIDATE ENGLANAUCTION");
        (address token,uint priceMin,bytes memory firstExtradata) = abi.decode(extra, (address, uint, bytes));
        StaticERC721.transferERC721Exact(firstExtradata,addresses, howToCalls[0], uints, data);
        bytes memory secondExtradata = abi.encode(token,priceMin,false);
        payAndFeeERC20(secondExtradata, [addresses[3], addresses[4], addresses[5], addresses[0], addresses[1], addresses[2], addresses[6]], howToCalls[1], uints, counterdata);
        return 1;
    }

    function dutchAuction(bytes memory extra,
                   address[7] memory addresses, AuthenticatedProxy.HowToCall[2] memory howToCalls, uint[6] memory uints,
                   bytes memory data, bytes memory counterdata)
        public
        view
        returns (uint)
    {
        (address token,uint basePrice,uint delta,bytes memory firstExtradata) = abi.decode(extra, (address, uint, uint, bytes));
        StaticERC721.transferERC721Exact(firstExtradata,addresses, howToCalls[0], uints, data);
        uint diff = delta.mul(block.timestamp.sub(uints[2])).div(uints[3].sub(uints[2]));
        basePrice = basePrice.sub(diff);
        bytes memory secondExtradata = abi.encode(token,basePrice,false);
        payAndFeeERC20(secondExtradata, [addresses[3], addresses[4], addresses[5], addresses[0], addresses[1], addresses[2], addresses[6]], howToCalls[1], uints, counterdata);
        return 1;
    }

    function fixDealer(bytes memory extra,
                   address[7] memory addresses, AuthenticatedProxy.HowToCall[2] memory howToCalls, uint[6] memory uints,
                   bytes memory data, bytes memory counterdata)
        public
        view
        returns (uint)
    {
        (address dealer,bytes4 selector,bytes memory extradata) = abi.decode(extra, (address,bytes4,bytes));
        require(dealer==addresses[4],"FIXED DEALER");
        require(staticCall(address(this), abi.encodeWithSelector(selector, extradata, addresses, howToCalls, uints, data,counterdata)));
        return 1;
    }

    function transferERC20MoreThan(bytes memory extra,
        address[7] memory addresses, AuthenticatedProxy.HowToCall howToCall, uint[6] memory,
        bytes memory data)
        internal
        pure
        returns (uint)
    {
        (address tokenGive,uint amount)=abi.decode(extra, (address,uint));
        bytes memory sig = ArrayUtils.arrayTake(abi.encodeWithSignature("transferFrom(address,address,uint256)"), 4);
        require(addresses[2] == tokenGive, "ERC20: call target must equal address of token");
        require(howToCall == AuthenticatedProxy.HowToCall.Call, "ERC20: call must be a direct call");
        require(ArrayUtils.arrayEq(sig, ArrayUtils.arrayTake(data, 4)));
        (address callFrom, address callTo, uint256 amountReal) = abi.decode(ArrayUtils.arrayDrop(data, 4), (address, address, uint256));
        require(callFrom == addresses[1]);
        require(callTo == addresses[4]);
        require(amountReal >= amount);
        return 1;
    }

    function payAndFeeERC20(bytes memory extra,
        address[7] memory addresses, AuthenticatedProxy.HowToCall howToCall, uint[6] memory uints,
        bytes memory cdata)
        public
        view
        returns (uint)
    {
        (address token, uint amount,bool isExact) = abi.decode(extra, (address, uint,bool));

        (address[] memory caddrs, uint[] memory cvals, uint[] memory clengths, bytes memory calldatas) = abi.decode(ArrayUtils.arrayDrop(cdata, 4), (address[], uint[], uint[], bytes));

        require(addresses[2] == atomicizer);
        require(howToCall == AuthenticatedProxy.HowToCall.DelegateCall);
        
        require(caddrs.length == 2); // Exact calls only
        //todo judge caddrs
        for (uint i = 0; i < 2; i++) {
            require(cvals[i] == 0);
        }

        addresses[2] = token;
        compact(addresses,uints,token,amount,isExact,clengths,calldatas);
        
        return 1;
    }

    function compact(address[7] memory addresses,uint[6] memory uints,address token, uint amount,bool isExact,uint[] memory clengths, bytes memory calldatas)internal view{
        (bytes memory transferExtradata,bytes memory feeExtradata) = calculateFee(amount,feeRate,token);
        (bytes memory callData0,bytes memory callData1)=splitCalldata(clengths,calldatas);
        if(isExact){
            transferERC20Exact(transferExtradata, addresses, AuthenticatedProxy.HowToCall.Call, uints, callData0);
            addresses[4]=feeRecipient;
            transferERC20Exact(feeExtradata, addresses, AuthenticatedProxy.HowToCall.Call, uints, callData1);
        }else{
            transferERC20MoreThan(transferExtradata, addresses, AuthenticatedProxy.HowToCall.Call, uints, callData0);
            addresses[4]=feeRecipient;
            transferERC20MoreThan(feeExtradata, addresses, AuthenticatedProxy.HowToCall.Call, uints, callData1);
        }
    }

    function splitCalldata(uint[] memory lengths,bytes memory callDatas)internal pure returns (bytes memory,bytes memory){
        uint k=0;
        bytes memory callData0 = new bytes(lengths[0]);
        bytes memory callData1 = new bytes(lengths[1]);
        for(uint i=0;i<lengths[0];i++){
            callData0[i]=callDatas[k];
            k++;
        }
        for(uint i=0;i<lengths[1];i++){
            callData1[i]=callDatas[k];
            k++;
        }
        return (callData0,callData1);
    }

    function calculateFee(uint amount,uint fRate,address token)internal pure returns(bytes memory,bytes memory){
        uint amount1 = amount.mul(fRate).div(10000);
        uint amount0 = amount.sub(amount1);
        bytes memory transferExtra = abi.encode(token,amount0);
        bytes memory feeExtra = abi.encode(token,amount1);
        return (transferExtra,feeExtra);
    }
}

