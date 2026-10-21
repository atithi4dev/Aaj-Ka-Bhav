def price_change(current: float | None, previous: float | None):
    if current is None or previous is None or current != current or previous != previous:
        return {"amount": None, "percentage": None, "direction": "insufficient_data"}
    amount = round(current - previous, 2)
    percentage = round((amount / previous) * 100, 2) if previous != 0 else None
    direction = "up" if amount > 0 else "down" if amount < 0 else "unchanged"
    return {"amount": amount, "percentage": percentage, "direction": direction}
