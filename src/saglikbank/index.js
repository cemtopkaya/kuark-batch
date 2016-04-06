function SaglikBank_Facade() {
    var db_saglikbank = require('./saglikbankdb'),
        sb = require('./saglikbank');

    function f_SB_Cek() {
        var arrIhaleler;

        return sb.f_getBids(1)
            .then(function (_arrIhaleler) {
                arrIhaleler = _arrIhaleler;
                console.log("tüm rss ihaleler çekildi, db işlemlerine başlıyoruz");
                return _arrIhaleler.map(function (_ihale) {
                    return db_saglikbank.f_DBIslemleri(_ihale)
                        .then(function (_res) {
                            console.log("DB Ihaleler: \n" + JSON.stringify(_res));
                            return _res;
                        })
                        .fail(function () {
                            console.log("İhaleler db ye yazılamadı!");
                            console.log(arguments);
                            return "ihaleler çekilemedi";
                        });
                });
            })
            .then(function (_res) {
                return arrIhaleler;
            })
            .fail(function () {
                console.log("RSS İhaleler çekilemedi!");
                console.log(arguments);
                return "ihaleler çekilemedi";
            });
    }

    return {
        f_SB_Cek: f_SB_Cek
    };
}
module.exports = SaglikBank_Facade();