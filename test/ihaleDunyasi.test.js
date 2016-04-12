/*var a = IhaleDunyasi();
 a.f_ihaleDunyasindanCek();
 ihaleDunyasi.f_ihaleDunyasindanCekRediseEkle();
 module.exports = SaglikBank_Facade();*/
var /** @type {IhaleDunyasi} */
    ihaleDunyasi = require('../index'),
    extensions = require("../../kuark-extensions");

describe('Ihale dünyasından veri çekilecek', function () {

    it('Tüm ihaleleri çek', function (done) {
        done()
    });

    it.only('Son x adet ihale çek', function (done) {

        this.timeout = 6000;

        ihaleDunyasi.f_ihaleDunyasindanCekRediseEkle(0, 2)
            .then(function (_sonuc) {
                done();
            })
            .fail(function (_err) {
                extensions.ssr = [{"_err": _err}];
                done(_err);
            });
    });

    it('ID\' li ihaleyi çek', function (done) {

        ihaleDunyasi.f_ihaleDunyasindanCekRediseEkle(10, 1)
            .then(function (_sonuc) {
                done();
            })
            .fail(function (_err) {
                extensions.ssr = [{"_err": _err}];
                done(_err);
            });
    });
});