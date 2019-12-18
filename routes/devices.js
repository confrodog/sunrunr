let express = require('express');
let router = express.Router();
let Device = require("../models/device");
let User = require('../models/users');
let fs = require('fs');
let jwt = require("jwt-simple");

/* Authenticate user */
var secret = fs.readFileSync(__dirname + '/../../jwtkey.txt').toString();

// Function to generate a random apikey consisting of 32 characters
function getNewApikey() {
    let newApikey = "";
    let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 32; i++) {
        newApikey += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return newApikey;
}

//POST register new device
router.post('/register', function(req, res, next) {
    let responseJson = {
        registered: false,
        message: "",
        apikey: "none",
        deviceId: "none"
    };
    let deviceExists = false;

    // Ensure the request includes the deviceId parameter
    if (!req.body.hasOwnProperty("deviceId")) {
        responseJson.message = "Missing deviceId.";
        return res.status(400).json(responseJson);
    }

    let email = "";

    // If authToken provided, use email in authToken 
    if (req.headers["x-auth"]) {
        try {
            let decodedToken = jwt.decode(req.headers["x-auth"], secret);
            email = decodedToken.email;
        } catch (ex) {
            responseJson.message = "Invalid authorization token.";
            return res.status(400).json(responseJson);
        }
    } else {
        // Ensure the request includes the email parameter
        if (!req.body.hasOwnProperty("email")) {
            responseJson.message = "Invalid authorization token or missing email address.";
            return res.status(400).json(responseJson);
        }
        email = req.body.email;
    }

    // See if device is already registered
    Device.findOne({ deviceId: req.body.deviceId }, function(err, device) {
        if (device !== null) {
            responseJson.message = "Device ID " + req.body.deviceId + " already registered.";
            return res.status(400).json(responseJson);
        } else {
            // Get a new apikey
            deviceApikey = getNewApikey();

            // Create a new device with specified id, user email, and randomly generated apikey.
            let newDevice = new Device({
                deviceId: req.body.deviceId,
                userEmail: email,
                apikey: deviceApikey
            });

            // Save device. If successful, return success. If not, return error message.
            newDevice.save(function(err, newDevice) {
                console.log("new device: " + newDevice);
                if (err) {
                    responseJson.message = err;
                    // This following is equivalent to: res.status(400).send(JSON.stringify(responseJson));
                    return res.status(400).json(responseJson);
                } else {
                    User.findOneAndUpdate({ email: email }, { $push: { userDevices: req.body.deviceId } }, (err, user) => {
                        //console.log("user: "+ user);
                        if (err) {
                            responseJson.message = err;
                            // This following is equivalent to: res.status(400).send(JSON.stringify(responseJson));
                            return res.status(400).json(responseJson);
                        } else {
                            responseJson.registered = true;
                            responseJson.apikey = deviceApikey;
                            responseJson.deviceId = req.body.deviceId;
                            responseJson.message = "Device ID " + req.body.deviceId + " was registered and added to " + user.email + " list.";
                            return res.status(201).json(responseJson);
                        }

                    });

                }
            });
        }
    });
});

//DELETE device
router.delete('/remove/:deviceId', (req, res) => {
    //console.log("deleting device...");
    //console.log(req.params);
    try {
        let decodedToken = jwt.decode(req.headers["x-auth"], secret);
    } catch (ex) {
        console.log("bad authorization");
        responseJson.message = "Invalid authorization token.";
        return res.status(400).json(responseJson);
    }
    Device.findOneAndRemove({ deviceId: req.params.deviceId }, (err, device) => {
        //console.log("DEvice email: "+device.userEmail);
        //console.log("removed device "+req.params.deviceId);
        User.findOneAndUpdate({ email: device.userEmail }, { $pull: { userDevices: req.params.deviceId } }, (err, user) => {
            //console.log("User: "+JSON.stringify(user));
            //console.log("removed device from user "+user.email);
            res.status(202).json({ "message": "good", "deviceId": req.params.deviceId });
        });
    });
});

module.exports = router;