'use strict';

var
    /** @type {DBModel} */
    db = require('kuark-db')();

/** @type {SaglikBankDB} */
function SaglikBankDB() {

    /** @type {SaglikBankDB} */
    var result = {};

    function f_KurumAdindanBul(kurumAdi) {
        var def_kurum = db.redis.dbQ.Q.defer();

        if (kurumAdi) {
            db.kurum.f_db_kurum_adlari_adi(kurumAdi)
                .then(function (_kurum) {
                    console.log("f_db_kurum_adlari_adi: " + _kurum);
                    def_kurum.resolve(_kurum);
                })
                .fail(function () {
                    console.log("kurum çekilemedi");
                    def_kurum.reject("kurum çekilemedi: " + JSON.stringify(arguments));
                });
        } else {
            console.log("kurum çekilemedi" + kurumAdi);
            def_kurum.reject("kurum çekilemedi: " + JSON.stringify(arguments));
        }
        return def_kurum.promise;
    }

    function f_SBIhaleIDdenBul(sb_ihale_id) {
        var def_ihale = db.redis.dbQ.Q.defer();

        if (sb_ihale_id) {

            db.ihale.f_db_ihale_sbihale_id(sb_ihale_id)
                .then(function (_ihale) {
                    def_ihale.resolve(_ihale);
                })
                .fail(function () {
                    def_ihale.reject("tüm ihaleler çekilemedi");
                });
        } else {
            def_ihale.reject("kontrol edilecek sb_ihale_id bulunamadı.");
        }

        return def_ihale.promise;
    }

    function f_DBIslemleri(_ihale) {
        /* Ihale var mı?
         Yok -> ekle { ihaleler_eklenen.push(ihale) }
         Var -> Eklenmedi  { ihaleler_eklenmeyen.push(ihale) }
         Kurum var mı?
         Yok -> ekle { kurumlar_eklenen.push(ihale.kurum) }
         Var -> ihale.kurum = db'den gelen Kurum nesnesi
         */
        var defer = db.redis.dbQ.Q.defer();

        f_KontrolveVTIslemleri(_ihale)
            .then(function (_res) {
                console.log("f_KontrolveVTIslemleri işlemi tamamlandı:" + _res);
                defer.resolve(_res);
            })
            .fail(function (_err) {
                console.log("f_KontrolveVTIslemleri işlemi başarılamadı..! " + _err);
                defer.reject("f_KontrolveVTIslemleri işlemi başarılamadı..!" + _err);
            });
        return defer.promise;
    }

    // function f_KontrolveVTIslemleri(arrKurumlarDB, arrIhalelerDB, _ihale) {
    function f_KontrolveVTIslemleri(_ihale) {

        var defer = db.redis.dbQ.Q.defer();

        /*
         * DB de ihale varsa, ilgili kurum ve satırlar vardır.
         * Yoksa Kurum, Ihale, Satırlar eklenecek
         */
        // db de var mı?
        console.log("ihale db de var mı?");

        f_SBIhaleIDdenBul(_ihale.id)
            .then(function (vtIhale) {
                return vtIhale
            })
            .fail(function (_err) {
                console.log("f_SBIhaleIDdenBul HATA ALINDI.! " + _err);
                defer.reject("f_SBIhaleIDdenBul HATA ALINDI.! " + _err);
            })
            .then(function (vtIhale) {
                if (vtIhale.Id) {
                    //ihale db de var
                    console.log("ihale db de var");
                    console.log(vtIhale);
                    _ihale.Id = vtIhale.Id;

                    db.ihale.f_db_ihale_kalem_tumu(_ihale.Id)
                        .then(function (_satirlar) {
                            console.log("dönen satırlar:" + _satirlar);
                            if (!_satirlar) {
                                //satırlarını eklemeye başla
                                _ihale.Kalemler.forEach(function (_satir) {
                                    console.log("satır içindeyim" + JSON.stringify(_satir));
                                    return f_SatirEkle(_ihale.Id, _satir);
                                });
                            }
                        });

                    defer.resolve(_ihale);
                }
                else {
                    /* ihale yok,
                     * - Önce ihalenin kurumu DB de varmı?
                     *     varsa kurum ID sini ihaleye yazalım
                     *     yoksa kurumu ekleyelim
                     * - Sonra ihaleyi,
                     * - Sonra satırları ekleyelim
                     */
                    console.log("ihale db de yok");
                    console.log("önce f_kurumkontrole gidiyoruz");

                    f_KurumKontrol(_ihale.Kurum)
                        .then(function (_kurum) {
                            console.log("f_KurumKontrol sonucu dönen kurum:" + _kurum);
                            console.log("f_ihalekontrol e gidiyoruz");
                            _ihale.Kurum_Id = _kurum.Id;
                            return _ihale;
                        })
                        .fail(function (_err) {
                            console.log("f_KurumKontrol HATA ALINDI.! " + _err);
                            defer.reject(_err);
                        })
                        .then(function (vtIhale) {
                            console.log("ihale ekleyecek");
                            f_IhaleEkle(vtIhale)
                                .then(function (_res) {
                                    console.log("ihale ekle res:" + _res);
                                    _ihale = _res;
                                    defer.resolve(_ihale);
                                })
                                .fail(function () {
                                    defer.reject("f_Ihaleekle HATA ALINDI.!");
                                });
                        });
                }
            });

        return defer.promise;
    }

    function f_IhaleEkle(_ihale) {
        var defer = db.redis.dbQ.Q.defer();

        // Ihale ekle

        console.log("f_IhaleEkle metoduna gelen ihale");
        console.log(JSON.stringify(_ihale));

        var sadeceIhaleBilgisi = {
            "IhaleNo": _ihale.IhaleNo,
            "Konusu": _ihale.Konusu,
            "IhaleTarihi": _ihale.IhaleTarihi,
            "SistemeEklenmeTarihi": _ihale.SistemeEklenmeTarihi,
            "IhaleUsul": _ihale.IhaleUsul,
            "YapilacagiAdres": _ihale.YapilacagiAdres,
            "SBIhale_Id": _ihale.id,
            "SartnameAdres": _ihale.SartnameAdres
        };

        db.ihale.f_db_ihale_ekle(sadeceIhaleBilgisi, _ihale.Kurum_Id, 0)
            .then(function (_dbRes) {
                console.log("ihale başarıyla eklendi.");
                var yeniIhale = JSON.parse(_dbRes);
                _ihale.Id = yeniIhale.Id;
                return _ihale;
            })
            .fail(function (_err) {
                console.log("ihale ekleyemedim HATA ALINDI.!: " + _err);
                defer.reject(_err);
            })
            .then(function (_res) {
                //satırlarını eklemeye başla
                _res.Satirlar.forEach(function (_satir) {

                    console.log("satır içinde dolaşıyorum" + JSON.stringify(_satir));
                    return f_SatirEkle(_res.Id, _satir);
                });

                return _res;
            })
            .fail(function () {
                defer.reject("ihaleye satır ekleyemedim HATA ALINDI.!");
            })
            .then(function (_res) {
                defer.resolve(_res);
            })
            .fail(function () {
                defer.reject("f_IhaleKontrol HATA ALINDI.!");
            });

        return defer.promise;
    }

    function f_KurumKontrol(kurum) {
        var defer = db.redis.dbQ.Q.defer();

        db.kurum.f_db_kurum_ekle(kurum)
            // Kurum ekle
            .then(function (_dbResults) {
                console.log("kurum eklendi/vt deki bilgisi geri döndü");
                defer.resolve(_dbResults);
            })
            .fail(function (_err) {
                console.log("Kurum eklenirken hata: ");
                defer.reject(_err);
            });

        return defer.promise;
    }

    function f_SatirEkle(_ihale_id, _satir) {
        return db.kalem.f_db_kalem_ekle(_ihale_id, _satir)
            .then(function (_dbSatir) {
                console.log(_dbSatir);
                var eklenenSatir = JSON.parse(_dbSatir);
                return eklenenSatir;
            })
            .fail(function () {
                console.log("Satır ekleme işlemi başarılamadı..!");
            });
    }


    /** @class SaglikBankDB */
    result = {
        f_DBIslemleri: f_DBIslemleri
    };

    return result;
}

/** @type {SaglikBankDB} */
var saglikBank = SaglikBankDB();
module.exports  = saglikBank;