function SaglikBank_Facade() {
    var http = require('http'),
        Q = require('q'),
        db_saglikbank = require('./../../batch/saglikbank/saglikbankdb').SaglikBankDB,
        sb = require('./../../batch/saglikbank/saglikbank').saglikBank;

    var f_SB_Cek = function () {
        var defer = Q.defer(),
            arrIhaleler;
        sb.f_getBids(1)
            .then(function (_arrIhaleler) {
                arrIhaleler = _arrIhaleler;
                console.log("tüm rss ihaleler çekildi, db işlemlerine başlıyoruz");
                return _arrIhaleler.map(function (_ihale) {
                    db_saglikbank.f_DBIslemleri(_ihale)
                        .then(function (_res) {
                            console.log("DB Ihaleler: \n" + JSON.stringify(_res));
                            return _res;
                        })
                        .fail(function () {
                            console.log("İhaleler db ye yazılamadı!");
                            console.log(arguments);
                            defer.reject("ihaleler çekilemedi");
                        });
                });
            })
            .then(function (_res) {
                defer.resolve(arrIhaleler);
            })
            .fail(function () {
                console.log("RSS İhaleler çekilemedi!");
                console.log(arguments);
                defer.reject("ihaleler çekilemedi");
            });

        return defer.promise;
    };

    return {
        f_SB_Cek: f_SB_Cek
    }
}
module.exports = SaglikBank_Facade();