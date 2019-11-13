import axios from "axios";
import {CreateOrderParams} from "./types";

const API_ENDPOINT = "http://localhost:3000/api/v2";


export default class Coinray {
  createOrder(order: CreateOrderParams) {
    this._request("POST", "/order", order)
  }

  _request(method: string, path: string, body: object) {
    axios.post(API_ENDPOINT + path, {
      method,
      body: JSON.stringify(body)
    }).then((result) => {
      console.log(result)
    })
  }
}
