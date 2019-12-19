import * as chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised'

chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('chai-http'));

import 'dotenv/config';
import validateEnv from '../src/utils/validateEnv';
validateEnv();

import { customer01 } from './_structs.test'

describe("Customer", () => {

    describe("Profile (/profile)", () => {
        it("1. should authenticate user (customer) - 200 Authenticate", (done) => {
            chai.request(`${process.env.API_URL}`)
                .post("auth/authenticate")
                .send({
                    email: customer01.email,
                    password: customer01.password
                })
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property('data');
                    res.body.data.should.be.a('object');
                    res.body.data.should.have.property('user');
                    res.body.data.should.have.property('token');
                    customer01.authToken = res.body.data.token.token;
                    done();
                });
        });
        it("2. should read user's profile - 200 Customer", (done) => {
            chai.request(`${process.env.API_URL}`)
                .get("profile")
                .set('Authorization', 'Bearer ' + customer01.authToken)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property('data');
                    res.body.data.should.be.a('object');
                    done();
                });
        });
        it("3. should NOT update customer's profile | name is empty - 400 Bad Request", (done) => {
            chai.request(`${process.env.API_URL}`)
                .put("profile")
                .set('Authorization', 'Bearer ' + customer01.authToken)
                .send({
                    imageURL: "http://customer_image.com"
                })
                .end((err, res) => {
                    res.should.have.status(400);
                    res.body.should.be.a('object');
                    res.body.should.have.property('message');
                    done();
                });
        });
        it("4. should update customer's profile - 200 Updated", (done) => {
            chai.request(`${process.env.API_URL}`)
                .put("profile")
                .set('Authorization', 'Bearer ' + customer01.authToken)
                .send({
                    imageURL: "http://customer_image.com",
                    name: "Random Name"
                })
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property('data');
                    res.body.data.should.be.a('object');
                    done();
                });
        });
    });
});

