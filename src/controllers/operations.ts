import {Request, Response} from "express";
import {Operation, OperationDocument} from "../models/Operation";
import {Swap, SwapDocument, SwapStatus} from "../models/Swap";
import logger from "../util/logger";
import {check, param, validationResult} from "express-validator";

export const getOperation = async (req: Request, res: Response) => {

    const id = req.params.operation;

    const operation: OperationDocument = await Operation.findOne({id: id});
    if (!operation) {
        res.status(404);
        res.send("Not found");
        return;
    }
    let swap: SwapDocument;
    if (operation.swap) {
        swap = await Swap.findById(operation.swap);
    } else if (operation.transactionHash) {
        swap = await Swap.findOne({src_tx_hash: operation.transactionHash});
        if (swap) {
            //logger.debug(`found ${tx._id}`)
            //const result = await operation.updateOne( {swap: tx._id, status: tx.status});
            operation.swap = swap._id;
            operation.status = swap.status;
            await operation.save();
            logger.info(`saved ${JSON.stringify(operation)}, ${JSON.stringify(swap)}`)
            // if (result.error) {
            //     logger.debug(`failed to update operation ${id}: with swap ${tx._id}: ${JSON.stringify(result.error)}`)
            // } else {
            //     logger.debug(`Updated operation ${id}: with swap ${tx._id} successfully`)
            // }
        }
    }
    res.json({operation, swap});
};

export const newOperation = async (req: Request, res: Response) => {

    await check("id", "Generated ID cannot be empty").not().isEmpty().run(req);
    await check("id", "Generated ID must be UUID").isUUID().run(req);
    await check("transactionHash", "TransactionHash malformed").isAlphanumeric().isLength({min: 1, max: 512}).optional().run(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.error(`Error: ${JSON.stringify(errors.array())}`);
        res.status(400);
        res.send({result: "failed", message: errors.array()});
        return;
    }


    const operation = new Operation({
        id: req.body.id,
        status: SwapStatus.SWAP_WAIT_SEND
    });

    if (req.body.transactionHash) {
        operation.transactionHash = escape(req.body.transactionHash);
    }

    await operation.save();
    res.json({operation});
};

export const updateOperation = async (req: Request, res: Response) => {
    await param("operation", "Operation ID must be UUID").isUUID().run(req);
    await check("transactionHash", "TransactionHash malformed").isAlphanumeric().isLength({min: 1, max: 512}).run(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.error(`Error updating transaction: ${JSON.stringify(errors.array())}`);
        res.status(400);
        res.send({result: "failed", message: errors.array()});
        return;
    }

    let txhash = escape(req.body.transactionHash);

    let resp = await Operation.updateOne({id: req.params.operation},
        {transactionHash: txhash, status: SwapStatus.SWAP_NOT_EXIST});
    if (resp.error) {
        logger.error(`Error updating transaction: ${JSON.stringify(resp.error)}`);
        res.status(400);
        res.send({result: "failed", message: resp.error});
        return;
    }

    res.json({result: "success"});
};
