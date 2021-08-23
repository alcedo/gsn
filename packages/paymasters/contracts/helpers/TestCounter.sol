//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestCounter {
    uint public count;

    constructor () {
        count = 0;
    }

    function increment() public payable{
        count = count + 1;
    }

    function get() public view returns (uint) {
        return count;
    }

    /* solhint-disable no-empty-blocks */
    receive() external payable {}
    fallback() external payable {}
}
