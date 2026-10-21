from app.services.analytics import price_change


def test_price_change_up():
    assert price_change(105, 100) == {
        "amount": 5, "percentage": 5.0, "direction": "up"
    }


def test_price_change_no_previous():
    assert price_change(105, None)["direction"] == "insufficient_data"


def test_price_change_zero_previous():
    result = price_change(105, 0)
    assert result["amount"] == 105
    assert result["percentage"] is None
